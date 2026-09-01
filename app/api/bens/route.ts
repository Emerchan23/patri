import { NextResponse } from "next/server"
import { execute, query, withTransaction } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"
import { criarNotificacao } from "@/lib/notifications"
import { saveImageToDisk } from "@/lib/image-utils"
import { saveFileToDisk } from "@/lib/file-utils"
import { appendScopeClause, getAssetScopeClause, isLocationInScope } from "@/lib/asset-scope"
import { ensureEtiquetasSchema } from "@/lib/etiquetas-schema"
import { getEtiquetaSequenceInfo } from "@/lib/etiquetas-sequence"
import { getEffectivePermissionsForUser } from "@/lib/auth-utils"
import { ensureAssetLabelWorkflowSchema } from "@/lib/asset-label-workflow-schema"

type PatrimonioConflictRecord = {
  id?: number
  patrimonio?: string | null
  patrimonio_provisorio?: string | null
}

class PatrimonioConflictError extends Error {
  status: number
  conflictingCode: string
  field: "patrimonio" | "patrimonioProvisorio"
  itemIndex?: number
  conflictingAssetId?: number

  constructor(params: {
    message: string
    conflictingCode: string
    field: "patrimonio" | "patrimonioProvisorio"
    itemIndex?: number
    conflictingAssetId?: number
  }) {
    super(params.message)
    this.name = "PatrimonioConflictError"
    this.status = 409
    this.conflictingCode = params.conflictingCode
    this.field = params.field
    this.itemIndex = params.itemIndex
    this.conflictingAssetId = params.conflictingAssetId
  }
}

function parseMysqlDuplicateCode(error: { sqlMessage?: string; message?: string }) {
  const rawMessage = String(error?.sqlMessage || error?.message || "")
  const match = rawMessage.match(/Duplicate entry '([^']+)'/i)
  return match?.[1] || null
}

const isProvisionalCode = (value: string | null | undefined) => {
  const code = (value || "").trim().toUpperCase()
  return code.startsWith("PROV-") || code.includes("AUTO")
}

const extractTrailingSequence = (code: string, prefix = "") => {
  if (!code) return null
  let clean = code.trim()
  if (prefix && clean.startsWith(prefix)) {
    clean = clean.substring(prefix.length)
  }

  const match = clean.match(/(\d+)(?!.*\d)/)
  if (!match) return null

  const value = parseInt(match[1], 10)
  return Number.isNaN(value) ? null : value
}

function parseSequencePattern(code: string) {
  const normalized = String(code || "").trim()
  const match = normalized.match(/^(.*?)(\d+)$/)
  if (!match) return null

  return {
    prefix: match[1],
    nextNumber: parseInt(match[2], 10),
    padding: match[2].length,
  }
}

function buildSequentialCode(prefix: string, nextNumber: number, padding: number) {
  return `${prefix}${String(nextNumber).padStart(padding, "0")}`
}

function normalizeScannerPatrimonioTerm(value: string) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "")
}

function extractScannerTrailingDigits(value: string) {
  const match = String(value || "").trim().match(/(\d+)(?!.*\d)/)
  if (!match) return null
  const digits = match[1].replace(/^0+/, "") || "0"
  return {
    raw: match[1],
    normalized: digits,
  }
}

async function runScannerPatrimonioLookup(user: any, rawTerm: string) {
  const scope = appendScopeClause("WHERE 1=1", [], getAssetScopeClause(user))
  const exactTerm = rawTerm.trim()
  const normalizedTerm = normalizeScannerPatrimonioTerm(exactTerm)
  const trailingDigits = extractScannerTrailingDigits(exactTerm)

  const runRows = async (extraClause: string, extraParams: unknown[]) => {
    const sql = `SELECT * FROM bens ${scope.whereClause} AND (${extraClause}) ORDER BY criado_em DESC LIMIT 10`
    const rows = await query(sql, [...scope.params, ...extraParams])
    return (rows as Record<string, unknown>[])
      .map(dbRowToAsset)
      .filter((asset): asset is NonNullable<ReturnType<typeof dbRowToAsset>> => asset !== null)
  }

  const exactMatches = await runRows(
    "patrimonio = ? OR patrimonio_provisorio = ?",
    [exactTerm, exactTerm]
  )
  if (exactMatches.length > 0) {
    return { mode: "exact" as const, assets: exactMatches }
  }

  if (normalizedTerm) {
    const normalizedMatches = await runRows(
      "UPPER(REPLACE(REPLACE(COALESCE(patrimonio, ''), '-', ''), ' ', '')) = ? OR UPPER(REPLACE(REPLACE(COALESCE(patrimonio_provisorio, ''), '-', ''), ' ', '')) = ?",
      [normalizedTerm, normalizedTerm]
    )
    if (normalizedMatches.length > 0) {
      return { mode: "normalized" as const, assets: normalizedMatches }
    }
  }

  if (trailingDigits?.normalized && trailingDigits.normalized !== "0") {
    const suffixMatches = await runRows(
      "patrimonio_provisorio LIKE ? OR REPLACE(REPLACE(COALESCE(patrimonio_provisorio, ''), '-', ''), ' ', '') LIKE ?",
      [`%${trailingDigits.raw}`, `%${trailingDigits.normalized}`]
    )
    if (suffixMatches.length > 0) {
      const uniqueAssets = Array.from(new Map(suffixMatches.map((asset) => [asset.id, asset])).values())
      return { mode: "suffix" as const, assets: uniqueAssets }
    }
  }

  return { mode: "none" as const, assets: [] as Array<NonNullable<ReturnType<typeof dbRowToAsset>>> }
}

const getDefinitivePrefix = (dateValue?: string | null) => {
  const fallbackYear = new Date().getFullYear()
  if (!dateValue) return `PAT-${fallbackYear}-`

  const date = new Date(dateValue)
  const year = Number.isNaN(date.getTime()) ? fallbackYear : date.getFullYear()
  return `PAT-${year}-`
}

async function getNextSequenceForPrefix(prefix: string, connection?: any) {
  const sql = "SELECT patrimonio FROM bens WHERE patrimonio LIKE ?"
  const params = [`${prefix}%`]
  const rows = connection
    ? ((await connection.execute(sql, params))[0] as Array<{ patrimonio: string }>)
    : (await query(sql, params) as Array<{ patrimonio: string }>)

  const usedNumbers = new Set<number>()
  for (const row of rows) {
    const seq = extractTrailingSequence(row.patrimonio, prefix)
    if (seq && seq > 0 && seq < 1000000) {
      usedNumbers.add(seq)
    }
  }

  let nextNum = 1
  while (usedNumbers.has(nextNum)) {
    nextNum++
  }
  return nextNum
}

async function generateAutomaticDefinitivePatrimonio(dateValue?: string | null, connection?: any) {
  const prefix = getDefinitivePrefix(dateValue)
  const nextNum = await getNextSequenceForPrefix(prefix, connection)
  return `${prefix}${String(nextNum).padStart(5, "0")}`
}

function normalizeCode(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase()
}

function getRequestConflict(
  requestCodes: Map<string, { field: "patrimonio" | "patrimonioProvisorio"; itemIndex?: number }>,
  patrimonio: string,
  patrimonioProvisorio?: string | null
) {
  const patrimonioCode = normalizeCode(patrimonio)
  const provisorioCode = normalizeCode(patrimonioProvisorio)
  return requestCodes.get(patrimonioCode) || (provisorioCode ? requestCodes.get(provisorioCode) : undefined) || null
}

function registerRequestCodes(
  requestCodes: Map<string, { field: "patrimonio" | "patrimonioProvisorio"; itemIndex?: number }>,
  patrimonio: string,
  patrimonioProvisorio?: string | null,
  itemIndex?: number
) {
  const patrimonioCode = normalizeCode(patrimonio)
  if (patrimonioCode) {
    requestCodes.set(patrimonioCode, { field: "patrimonio", itemIndex })
  }

  const provisorioCode = normalizeCode(patrimonioProvisorio)
  if (provisorioCode) {
    requestCodes.set(provisorioCode, { field: "patrimonioProvisorio", itemIndex })
  }
}

async function findPatrimonioConflict(
  patrimonio: string,
  patrimonioProvisorio?: string | null,
  connection?: any
) {
  const params: string[] = [patrimonio]
  let sql = "SELECT id, patrimonio, patrimonio_provisorio FROM bens WHERE patrimonio = ? OR patrimonio_provisorio = ?"
  params.push(patrimonio)

  if (patrimonioProvisorio && patrimonioProvisorio !== patrimonio) {
    sql += " OR patrimonio = ? OR patrimonio_provisorio = ?"
    params.push(patrimonioProvisorio, patrimonioProvisorio)
  }

  const rows = connection
    ? ((await connection.execute(sql, params))[0] as Array<PatrimonioConflictRecord>)
    : (await query(sql, params) as Array<PatrimonioConflictRecord>)
  return rows[0] || null
}

function extractConflictingCode(
  conflict: PatrimonioConflictRecord | null,
  patrimonio: string,
  patrimonioProvisorio?: string | null
) {
  const patrimonioCode = normalizeCode(patrimonio)
  const provisorioCode = normalizeCode(patrimonioProvisorio)
  const rowPatrimonio = normalizeCode(conflict?.patrimonio)
  const rowProvisorio = normalizeCode(conflict?.patrimonio_provisorio)

  if (rowPatrimonio && (rowPatrimonio === patrimonioCode || rowPatrimonio === provisorioCode)) {
    return { code: conflict?.patrimonio || patrimonio, field: "patrimonio" as const }
  }

  if (rowProvisorio && (rowProvisorio === patrimonioCode || rowProvisorio === provisorioCode)) {
    return { code: conflict?.patrimonio_provisorio || patrimonioProvisorio || patrimonio, field: "patrimonioProvisorio" as const }
  }

  return { code: patrimonioProvisorio || patrimonio, field: patrimonioProvisorio ? "patrimonioProvisorio" as const : "patrimonio" as const }
}

function buildDuplicateError(params: {
  conflictingCode: string
  field: "patrimonio" | "patrimonioProvisorio"
  itemIndex?: number
  conflictingAssetId?: number
  duplicateWithinRequest?: boolean
}) {
  const codeLabel = params.field === "patrimonio" ? "patrimonio" : "patrimônio provisório"
  const duplicateContext = params.duplicateWithinRequest
    ? "dentro desta mesma operação"
    : "em outro bem já cadastrado"
  const itemContext = typeof params.itemIndex === "number" ? ` no item ${params.itemIndex + 1}` : ""

  return new PatrimonioConflictError({
    message: `O ${codeLabel} ${params.conflictingCode} já está em uso ${duplicateContext}${itemContext}.`,
    conflictingCode: params.conflictingCode,
    field: params.field,
    itemIndex: params.itemIndex,
    conflictingAssetId: params.conflictingAssetId,
  })
}

async function regenerateAutomaticProvisionalIfNeeded(
  payload: {
    patrimonioTipo?: string
    patrimonio?: string | null
    patrimonioProvisorio?: string | null
    patrimonioAutoGerado?: boolean
    dataAquisicao?: string | null
  },
  connection?: any
) {
  const patrimonioAtual = String(payload.patrimonio || "").trim()
  const patrimonioProvisorioAtual = String(payload.patrimonioProvisorio || "").trim()
  const isAutoGeneratedProvisional =
    payload.patrimonioTipo === "provisorio" &&
    payload.patrimonioAutoGerado === true &&
    !!patrimonioAtual &&
    patrimonioAtual === patrimonioProvisorioAtual &&
    isProvisionalCode(patrimonioAtual)

  if (!isAutoGeneratedProvisional) {
    return {
      patrimonio: patrimonioAtual,
      patrimonioProvisorio: patrimonioProvisorioAtual || null,
      patrimonioTipo: payload.patrimonioTipo || "provisorio",
    }
  }

  let year = new Date().getFullYear().toString()
  if (payload.dataAquisicao) {
    const date = new Date(payload.dataAquisicao)
    if (!Number.isNaN(date.getTime())) {
      year = date.getFullYear().toString()
    }
  }

  const info = await getEtiquetaSequenceInfo(year, connection)
  return {
    patrimonio: info.formatted,
    patrimonioProvisorio: info.formatted,
    patrimonioTipo: "provisorio" as const,
  }
}

function getProvisionalYearFromPayload(payload: {
  patrimonio?: string | null
  patrimonioProvisorio?: string | null
  dataAquisicao?: string | null
}) {
  const candidate = String(payload.patrimonioProvisorio || payload.patrimonio || "").trim().toUpperCase()
  const match = candidate.match(/^PROV-(\d{4})-/)
  if (match) return match[1]

  if (payload.dataAquisicao) {
    const date = new Date(payload.dataAquisicao)
    if (!Number.isNaN(date.getTime())) {
      return String(date.getFullYear())
    }
  }

  return String(new Date().getFullYear())
}

async function resolveAutomaticAssetCodes(
  payload: {
    patrimonioTipo?: string
    patrimonio?: string | null
    patrimonioProvisorio?: string | null
    patrimonioAutoGerado?: boolean
    dataAquisicao?: string | null
  },
  connection?: any,
  definitiveState?: Map<string, number>,
  provisionalState?: Map<string, number>
) {
  const requestedType = payload.patrimonioTipo || "provisorio"
  const patrimonioAtual = String(payload.patrimonio || "").trim()
  const patrimonioProvisorioAtual = String(payload.patrimonioProvisorio || "").trim()
  const provisionalAutoRequested =
    requestedType === "provisorio" &&
    (
      payload.patrimonioAutoGerado === true ||
      (!patrimonioAtual && !patrimonioProvisorioAtual) ||
      patrimonioAtual.includes("AUTO") ||
      patrimonioProvisorioAtual.includes("AUTO")
    )

  if (provisionalAutoRequested) {
    const year = getProvisionalYearFromPayload(payload)
    let nextSeq = provisionalState?.get(year)
    if (!nextSeq) {
      const info = await getEtiquetaSequenceInfo(year, connection)
      nextSeq = info.nextSeq
    }
    provisionalState?.set(year, nextSeq + 1)
    return {
      patrimonio: `PROV-${year}-${String(nextSeq).padStart(5, "0")}`,
      patrimonioProvisorio: `PROV-${year}-${String(nextSeq).padStart(5, "0")}`,
      patrimonioTipo: "provisorio" as const,
      generatedAutomatically: true,
    }
  }

  const definitiveAutoRequested =
    requestedType === "definitivo" &&
    (!patrimonioAtual || patrimonioAtual.includes("AUTO"))

  if (definitiveAutoRequested) {
    const prefix = getDefinitivePrefix(payload.dataAquisicao)
    let nextSeq = definitiveState?.get(prefix)
    if (!nextSeq) {
      nextSeq = await getNextSequenceForPrefix(prefix, connection)
    }
    definitiveState?.set(prefix, nextSeq + 1)

    return {
      patrimonio: `${prefix}${String(nextSeq).padStart(5, "0")}`,
      patrimonioProvisorio: String(payload.patrimonioProvisorio || "").trim() || null,
      patrimonioTipo: "definitivo" as const,
      generatedAutomatically: true,
    }
  }

  return {
    patrimonio: requestedType === "provisorio" ? (patrimonioAtual || patrimonioProvisorioAtual) : patrimonioAtual,
    patrimonioProvisorio:
      requestedType === "provisorio"
        ? (patrimonioProvisorioAtual || patrimonioAtual || null)
        : (patrimonioProvisorioAtual || null),
    patrimonioTipo: requestedType as "definitivo" | "provisorio",
    generatedAutomatically: false,
  }
}

async function normalizeAssetInsertPayload(
  payload: any,
  connection?: any,
  definitiveState?: Map<string, number>,
  provisionalState?: Map<string, number>,
  requestCodes?: Map<string, { field: "patrimonio" | "patrimonioProvisorio"; itemIndex?: number }>,
  itemIndex?: number
) {
  const resolved = await resolveAutomaticAssetCodes(payload, connection, definitiveState, provisionalState)
  if (!resolved.patrimonio) {
    throw new Error("Patrimonio ou Patrimonio Provisorio obrigatorio")
  }

  let patrimonioFinal = resolved.patrimonio
  let patrimonioTipoFinal = isProvisionalCode(patrimonioFinal) ? "provisorio" : resolved.patrimonioTipo
  let patrimonioProvisorioFinal = patrimonioTipoFinal === "provisorio"
    ? patrimonioFinal
    : resolved.patrimonioProvisorio

  let conflictingAsset = await findPatrimonioConflict(patrimonioFinal, patrimonioProvisorioFinal, connection)
  let requestConflict = requestCodes ? getRequestConflict(requestCodes, patrimonioFinal, patrimonioProvisorioFinal) : null
  let attempts = 0

  while ((conflictingAsset || requestConflict) && resolved.generatedAutomatically && attempts < 10) {
    attempts += 1
    const regenerated = await resolveAutomaticAssetCodes(
      {
        ...payload,
        patrimonio: payload.patrimonioTipo === "definitivo" ? `${getDefinitivePrefix(payload.dataAquisicao)}AUTO` : payload.patrimonio,
        patrimonioProvisorio: payload.patrimonioTipo === "provisorio" ? payload.patrimonioProvisorio || payload.patrimonio || `PROV-${getProvisionalYearFromPayload(payload)}-AUTO` : payload.patrimonioProvisorio,
        patrimonioAutoGerado: true,
      },
      connection,
      definitiveState,
      provisionalState
    )
    patrimonioFinal = regenerated.patrimonio
    patrimonioTipoFinal = isProvisionalCode(patrimonioFinal) ? "provisorio" : regenerated.patrimonioTipo
    patrimonioProvisorioFinal = patrimonioTipoFinal === "provisorio" ? patrimonioFinal : regenerated.patrimonioProvisorio
    conflictingAsset = await findPatrimonioConflict(patrimonioFinal, patrimonioProvisorioFinal, connection)
    requestConflict = requestCodes ? getRequestConflict(requestCodes, patrimonioFinal, patrimonioProvisorioFinal) : null
  }

  let duplicateError: PatrimonioConflictError | null = null
  if (requestConflict) {
    duplicateError = buildDuplicateError({
      conflictingCode: patrimonioTipoFinal === "provisorio" ? patrimonioProvisorioFinal || patrimonioFinal : patrimonioFinal,
      field: requestConflict.field,
      itemIndex,
      duplicateWithinRequest: true,
    })
  } else if (conflictingAsset) {
    const conflictInfo = extractConflictingCode(conflictingAsset, patrimonioFinal, patrimonioProvisorioFinal)
    duplicateError = buildDuplicateError({
      conflictingCode: conflictInfo.code,
      field: conflictInfo.field,
      itemIndex,
      conflictingAssetId: conflictingAsset.id,
    })
  }

  return {
    patrimonioFinal,
    patrimonioTipoFinal,
    patrimonioProvisorioFinal,
    conflictingAsset,
    duplicateError,
    generatedAutomatically: resolved.generatedAutomatically,
  }
}

// GET /api/bens - List assets with filters
export const GET = withAuth(async (request, { user }) => {
  await ensureAssetLabelWorkflowSchema()
  const url = new URL(request.url)
  const secretaria = url.searchParams.get("secretaria")
  const departamento = url.searchParams.get("departamento")
  const sala = url.searchParams.get("sala")
  const categoria = url.searchParams.get("categoria")
  const grupo = url.searchParams.get("grupo")
  const status = url.searchParams.get("status")
  const tipo = url.searchParams.get("tipo")
  const busca = url.searchParams.get("busca")
  const patrimonio = url.searchParams.get("patrimonio")
  const scannerLookup = url.searchParams.get("scanner_lookup") === "true"
  const provisorios = url.searchParams.get("provisorios")
  const veiculos = url.searchParams.get("veiculos")
  const emGarantia = url.searchParams.get("em_garantia")
  const emenda = url.searchParams.get("emenda")

  const page = parseInt(url.searchParams.get("page") || "1")
  const limit = parseInt(url.searchParams.get("limit") || "20")
  const offset = (page - 1) * limit

  const scoped = appendScopeClause("WHERE 1=1", [], getAssetScopeClause(user))
  let whereClause = scoped.whereClause
  const params: unknown[] = [...scoped.params]

  if (patrimonio && scannerLookup) {
    await ensureEtiquetasSchema()
    const currentYear = new Date().getFullYear().toString()
    const nextEtiquetaInfo = await getEtiquetaSequenceInfo(currentYear)
    const lookup = await runScannerPatrimonioLookup(user, patrimonio)

    return NextResponse.json({
      data: lookup.assets,
      meta: {
        total: lookup.assets.length,
        page: 1,
        limit: lookup.assets.length || 10,
        totalPages: lookup.assets.length > 0 ? 1 : 0,
        nextProvisionalSeq: nextEtiquetaInfo.nextSeq,
        scannerLookup: {
          mode: lookup.mode,
          ambiguous: lookup.assets.length > 1,
          searchedTerm: patrimonio,
        },
      },
    })
  }

  if (patrimonio) {
    whereClause += " AND (patrimonio = ? OR patrimonio_provisorio = ?)"
    params.push(patrimonio, patrimonio)
  }

  if (emenda) {
    whereClause += " AND emenda_parlamentar LIKE ?"
    params.push(`%${emenda}%`)
  }

  if (secretaria) {
    whereClause += " AND localizacao_secretaria LIKE ?"
    params.push(`%${secretaria}%`)
  }

  if (departamento) {
    whereClause += " AND localizacao_departamento LIKE ?"
    params.push(`%${departamento}%`)
  }

  if (sala) {
    whereClause += " AND localizacao_sala LIKE ?"
    params.push(`%${sala}%`)
  }

  if (categoria) {
    whereClause += " AND categoria_slug = ?"
    params.push(categoria)
  }

  if (grupo) {
    whereClause += " AND grupo = ?"
    params.push(grupo)
  }

  if (status) {
    whereClause += " AND status = ?"
    params.push(status)
  }

  if (tipo) {
    whereClause += " AND patrimonio_tipo = ?"
    params.push(tipo)
  }

  if (provisorios === "true") {
    whereClause += " AND patrimonio_tipo = 'provisorio'"
  }

  if (veiculos === "true") {
    whereClause += " AND categoria_slug = 'veiculo'"
  } else if (veiculos === "false") {
    whereClause += " AND categoria_slug != 'veiculo'"
  }

  if (emGarantia === "true") {
    whereClause += " AND tempo_garantia > 0 AND DATE_ADD(data_aquisicao, INTERVAL tempo_garantia MONTH) >= CURDATE()"
  } else if (emGarantia === "false") {
    whereClause += " AND (tempo_garantia IS NULL OR tempo_garantia = 0 OR DATE_ADD(data_aquisicao, INTERVAL tempo_garantia MONTH) < CURDATE())"
  }

  if (busca) {
    whereClause += " AND (patrimonio LIKE ? OR descricao LIKE ? OR responsavel_nome LIKE ? OR marca LIKE ? OR modelo LIKE ? OR numero_serie LIKE ? OR localizacao_secretaria LIKE ? OR emenda_parlamentar LIKE ?)"
    const term = `%${busca}%`
    params.push(term, term, term, term, term, term, term, term)
  }

  const countSql = `SELECT COUNT(*) as total FROM bens ${whereClause}`
  const countResult = await query(countSql, params) as any[]
  const total = countResult[0]?.total || 0
  const totalPages = Math.ceil(total / limit)

  await ensureEtiquetasSchema()
  const currentYear = new Date().getFullYear().toString()
  const nextEtiquetaInfo = await getEtiquetaSequenceInfo(currentYear)
  const nextSeq = nextEtiquetaInfo.nextSeq

  const sql = `SELECT * FROM bens ${whereClause} ORDER BY criado_em DESC LIMIT ${limit} OFFSET ${offset}`
  const rows = await query(sql, params)
  const assets = (rows as Record<string, unknown>[])
    .map(dbRowToAsset)
    .filter((asset): asset is NonNullable<ReturnType<typeof dbRowToAsset>> => asset !== null)

  return NextResponse.json({
    data: assets,
    meta: {
      total,
      page,
      limit,
      totalPages,
      nextProvisionalSeq: nextSeq,
    },
  })
})

// POST /api/bens - Create asset
export const POST = withAuth(async (request, { user }) => {
  if (!getEffectivePermissionsForUser(user).cadastrarBem) {
    return NextResponse.json({ error: "Sem permissao para cadastrar novos bens." }, { status: 403 })
  }

  let body
  try {
    body = await request.json()
  } catch (error) {
    console.error("Erro ao ler JSON do request (provavelmente body muito grande):", error)
    return NextResponse.json({ error: "Payload invalido ou muito grande" }, { status: 413 })
  }

  await ensureEtiquetasSchema()
  await ensureAssetLabelWorkflowSchema()

  if (Array.isArray(body)) {
    try {
      const ids = await withTransaction(async (connection) => {
        const insertedIds: number[] = []
        const processedImages = new Map<string, string>()
        const processedFiles = new Map<string, string>()
        const autoPrefixState = new Map<string, number>()
        const autoProvisionalState = new Map<string, number>()
        const requestCodes = new Map<string, { field: "patrimonio" | "patrimonioProvisorio"; itemIndex?: number }>()

        for (let itemIndex = 0; itemIndex < body.length; itemIndex++) {
          const item = body[itemIndex]
          if (!isLocationInScope(user, item.localizacao)) {
            throw new Error("Sem permissao para cadastrar bem nesta localizacao")
          }
          if (!item.imagem) {
            throw new Error(`Imagem e obrigatoria para o item: ${item.descricao || "sem descricao"}`)
          }

          const imagePath = processedImages.get(item.imagem) || saveImageToDisk(item.imagem)
          if (imagePath) processedImages.set(item.imagem, imagePath)

          let notaFiscalPath = null
          if (item.notaFiscal) {
            notaFiscalPath = processedFiles.get(item.notaFiscal) || saveFileToDisk(item.notaFiscal)
            if (notaFiscalPath) processedFiles.set(item.notaFiscal, notaFiscalPath)
          }

          const normalized = await normalizeAssetInsertPayload(
            item,
            connection,
            autoPrefixState,
            autoProvisionalState,
            requestCodes,
            itemIndex
          )
          const patrimonioFinal = normalized.patrimonioFinal
          const patrimonioTipoFinal = normalized.patrimonioTipoFinal
          const patrimonioProvisorioFinal = normalized.patrimonioProvisorioFinal
          const duplicateError = normalized.duplicateError

          if (duplicateError) {
            throw duplicateError
          }

          registerRequestCodes(requestCodes, patrimonioFinal, patrimonioProvisorioFinal, itemIndex)
          const etiquetaStatusInicial = null

          const [result] = await connection.execute(
            `INSERT INTO bens (patrimonio, patrimonio_provisorio, patrimonio_tipo, descricao, categoria_slug, grupo,
             localizacao_secretaria, localizacao_departamento, localizacao_sala, responsavel_nome, responsavel_cargo,
             data_aquisicao, valor, status, marca, modelo, numero_serie, estado_conservacao, observacoes, imagem, placa, ano, km_atual, tempo_garantia, fornecedor, nota_fiscal_url, emenda_parlamentar, tipo_entrada, etiqueta_status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              patrimonioFinal,
              patrimonioProvisorioFinal,
              patrimonioTipoFinal,
              item.descricao,
              item.categoria,
              item.grupo || "Geral",
              item.localizacao?.secretaria || "Nao Informado",
              item.localizacao?.departamento || "Nao Informado",
              item.localizacao?.sala || "Nao Informado",
              item.responsavel?.nome || "Nao Informado",
              item.responsavel?.cargo || "Nao Informado",
              item.dataAquisicao || new Date().toISOString().split("T")[0],
              item.valor || 0,
              item.status || "ativo",
              item.marca || null,
              item.modelo || null,
              item.numeroSerie || null,
              item.estadoConservacao || null,
              item.observacoes || null,
              imagePath || null,
              item.placa || null,
              item.ano || null,
              item.kmAtual || null,
              item.tempoGarantia || null,
              item.fornecedor || null,
              notaFiscalPath || null,
              item.emendaParlamentar || null,
              item.tipoEntrada || "compra",
              etiquetaStatusInicial,
            ]
          )

          const insertId = (result as any).insertId
          insertedIds.push(insertId)

          if (patrimonioProvisorioFinal) {
            await connection.execute(
              `UPDATE etiquetas_provisorias
                  SET status = 'usada',
                      bem_id = ?,
                      usado_em = NOW()
                WHERE codigo = ?`,
              [insertId, patrimonioProvisorioFinal]
            )
          }
        }

        return insertedIds
      })

      await registrarLog({
        acao: "entrada_nf",
        descricao: `Entrada em lote: ${body.length} itens cadastrados`,
        detalhes: body.map((b: Record<string, unknown>) => b.descricao).join(", "),
        usuarioId: user.id,
        usuarioNome: user.nome,
        usuarioRole: user.role,
        dadosNovos: { totalItens: body.length },
      })

      await criarNotificacao({
        roleDestino: "gestor",
        titulo: "Novos bens cadastrados em lote",
        mensagem: `${body.length} bens foram cadastrados por ${user.nome}.`,
        tipo: "info",
        link: "bens",
      })

      return NextResponse.json({ ids, count: ids.length }, { status: 201 })
    } catch (error: any) {
      console.error("Erro no cadastro em lote:", error)
      if (error instanceof PatrimonioConflictError) {
        return NextResponse.json(
          {
            error: error.message,
            status: 409,
            conflictType: error.field,
            conflictingCode: error.conflictingCode,
            itemIndex: error.itemIndex ?? null,
            conflictingAssetId: error.conflictingAssetId ?? null,
          },
          { status: 409 }
        )
      }
      if (error.code === "ER_DUP_ENTRY") {
        const conflictingCode = parseMysqlDuplicateCode(error)
        return NextResponse.json(
          {
            error: conflictingCode
              ? `O patrimônio ${conflictingCode} já está em uso. Ajuste a numeração e tente novamente.`
              : "Já existe um bem cadastrado com este patrimônio ou patrimônio provisório.",
            status: 409,
            conflictType: "patrimonio",
            conflictingCode,
            itemIndex: null,
          },
          { status: 409 }
        )
      }
      if (error.message === "Sem permissao para cadastrar bem nesta localizacao") {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
      return NextResponse.json({ error: error.message || "Erro ao processar cadastro em lote." }, { status: 500 })
    }
  }

  try {
    if (!isLocationInScope(user, body.localizacao)) {
      return NextResponse.json({ error: "Sem permissao para cadastrar bem nesta localizacao" }, { status: 403 })
    }
    if (!body.descricao) return NextResponse.json({ error: "Descricao e obrigatoria" }, { status: 400 })
    if (!body.categoria) return NextResponse.json({ error: "Categoria e obrigatoria" }, { status: 400 })
    if (!body.imagem) return NextResponse.json({ error: "Imagem e obrigatoria" }, { status: 400 })

    const imagePath = saveImageToDisk(body.imagem)
    const notaFiscalPath = saveFileToDisk(body.notaFiscal)
    const quantidade = Math.max(1, parseInt(String(body.quantidade || 1)))
    const manualDefinitiveSequence =
      body.patrimonioTipo === "definitivo" && body.patrimonio && !String(body.patrimonio).includes("AUTO")
        ? parseSequencePattern(String(body.patrimonio))
        : null
    const manualProvisionalSequence =
      body.patrimonioTipo === "provisorio" && body.patrimonioProvisorio && !String(body.patrimonioProvisorio).includes("AUTO")
        ? parseSequencePattern(String(body.patrimonioProvisorio))
        : null

    if (quantidade > 1 && body.patrimonioTipo === "definitivo" && body.patrimonio && !manualDefinitiveSequence) {
      return NextResponse.json(
        { error: "Formato de patrimonio inicial invalido. Use um valor com sequencia numérica final, como PAT-2026-00001." },
        { status: 400 }
      )
    }

    if (quantidade > 1 && body.patrimonioTipo === "provisorio" && body.patrimonioProvisorio && !String(body.patrimonioProvisorio).includes("AUTO") && !manualProvisionalSequence) {
      return NextResponse.json(
        { error: "Formato de patrimonio provisório inicial invalido. Use um valor com sequencia numérica final." },
        { status: 400 }
      )
    }

    const ids = await withTransaction(async (connection) => {
      const insertedIds: number[] = []
      const autoPrefixState = new Map<string, number>()
      const autoProvisionalState = new Map<string, number>()
      const requestCodes = new Map<string, { field: "patrimonio" | "patrimonioProvisorio"; itemIndex?: number }>()

      for (let i = 0; i < quantidade; i++) {
        const iterationPayload = { ...body }

        if (manualDefinitiveSequence) {
          iterationPayload.patrimonio = buildSequentialCode(
            manualDefinitiveSequence.prefix,
            manualDefinitiveSequence.nextNumber + i,
            manualDefinitiveSequence.padding
          )
          iterationPayload.patrimonioAutoGerado = false
        }

        if (manualProvisionalSequence) {
          iterationPayload.patrimonioProvisorio = buildSequentialCode(
            manualProvisionalSequence.prefix,
            manualProvisionalSequence.nextNumber + i,
            manualProvisionalSequence.padding
          )
          iterationPayload.patrimonioAutoGerado = false
        }

        const normalized = await normalizeAssetInsertPayload(
          {
            ...iterationPayload,
            patrimonioAutoGerado:
              Boolean(iterationPayload.patrimonioAutoGerado) ||
              String(iterationPayload.patrimonio || iterationPayload.patrimonioProvisorio || "").includes("AUTO") ||
              (!iterationPayload.patrimonio && !iterationPayload.patrimonioProvisorio),
          },
          connection,
          autoPrefixState,
          autoProvisionalState,
          requestCodes,
          i
        )

        if (normalized.duplicateError) {
          throw normalized.duplicateError
        }

        const dbPatrimonio = normalized.patrimonioFinal
        const dbProvisorio = normalized.patrimonioProvisorioFinal
        const finalPatrimonioTipo = normalized.patrimonioTipoFinal

        registerRequestCodes(requestCodes, dbPatrimonio, dbProvisorio, i)

        if (dbProvisorio) {
          const [updateResult] = await connection.execute(
            `UPDATE etiquetas_provisorias
                SET status = 'em_uso'
              WHERE codigo = ?
                AND status IN ('reservada', 'disponivel', 'disponivel_para_reuso')`,
            [dbProvisorio]
          )

          if (Number((updateResult as any).affectedRows || 0) === 0) {
            await connection.execute(
              `INSERT INTO etiquetas_provisorias (codigo, status, reservado_por_usuario_id, reservado_por_nome)
               VALUES (?, 'em_uso', ?, ?)`,
              [dbProvisorio, user.id, user.nome]
            ).catch(() => undefined)
          }
        }

        const etiquetaStatusInicial = null
        const [result] = await connection.execute(
          `INSERT INTO bens (patrimonio, patrimonio_provisorio, patrimonio_tipo, descricao, categoria_slug, grupo,
           localizacao_secretaria, localizacao_departamento, localizacao_sala, responsavel_nome, responsavel_cargo,
           data_aquisicao, valor, status, marca, modelo, numero_serie, estado_conservacao, observacoes, imagem, placa, ano, km_atual, tempo_garantia, fornecedor, nota_fiscal_url, emenda_parlamentar, tipo_entrada, etiqueta_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
          [
            dbPatrimonio,
            dbProvisorio,
            finalPatrimonioTipo,
            body.descricao,
            body.categoria,
            body.grupo || "Geral",
            body.localizacao?.secretaria || "Nao Informado",
            body.localizacao?.departamento || "Nao Informado",
            body.localizacao?.sala || "Nao Informado",
            body.responsavel?.nome || "Nao Informado",
            body.responsavel?.cargo || "Nao Informado",
            body.dataAquisicao || new Date().toISOString().split("T")[0],
            body.valor || 0,
            body.status || "ativo",
            body.marca || null,
            body.modelo || null,
            body.numeroSerie || null,
            body.estadoConservacao || null,
            body.observacoes || null,
            imagePath || null,
            body.placa || null,
            body.ano || null,
            body.kmAtual || null,
            body.tempoGarantia || null,
            body.fornecedor || null,
            notaFiscalPath || null,
            body.emendaParlamentar || null,
            body.tipoEntrada || "compra",
            etiquetaStatusInicial,
          ]
        )
        const insertId = (result as any).insertId
        insertedIds.push(insertId)

        if (dbProvisorio) {
          await connection.execute(
            `UPDATE etiquetas_provisorias
                SET status = 'usada',
                    bem_id = ?,
                    usado_em = NOW()
              WHERE codigo = ?`,
            [insertId, dbProvisorio]
          )
        }
      }

      return insertedIds
    })

    await registrarLog({
      acao: "cadastro",
      descricao: `Novo(s) bem(ns) cadastrado(s): ${body.descricao}`,
      detalhes: `Quantidade: ${quantidade}`,
      usuarioId: user.id,
      usuarioNome: user.nome,
      usuarioRole: user.role,
      entidadeTipo: "bem",
      entidadeId: String(ids[0]),
      entidadeDescricao: body.descricao,
      dadosNovos: { quantidade, categoria: body.categoria, valor: body.valor },
    })

    if (body.patrimonioTipo === "provisorio") {
      await criarNotificacao({
        roleDestino: "gestor",
        titulo: "Bem(ns) aguardando patrimonio definitivo",
        mensagem: `${quantidade}x ${body.descricao} foram cadastrados com patrimonio provisorio.`,
        tipo: "warning",
        link: "pendencias",
      })
    }

    return NextResponse.json({ id: ids[0], ids, count: ids.length }, { status: 201 })
  } catch (error: any) {
    console.error("Erro no cadastro individual:", error)
    if (error instanceof PatrimonioConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          status: 409,
          conflictType: error.field,
          conflictingCode: error.conflictingCode,
          itemIndex: error.itemIndex ?? null,
          conflictingAssetId: error.conflictingAssetId ?? null,
        },
        { status: 409 }
      )
    }
    if (error.code === "ER_DUP_ENTRY") {
      const conflictingCode = parseMysqlDuplicateCode(error)
      return NextResponse.json(
        {
          error: conflictingCode
            ? `O patrimônio ${conflictingCode} já está em uso. Informe outro número para continuar.`
            : "Já existe um bem cadastrado com este patrimônio ou patrimônio provisório.",
          status: 409,
          conflictType: "patrimonio",
          conflictingCode,
          itemIndex: null,
        },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message || "Erro ao cadastrar bem. Verifique os dados e tente novamente." }, { status: 500 })
  }
})

function dbRowToAsset(row: Record<string, unknown>) {
  try {
    let dataAquisicao = ""
    if (row.data_aquisicao) {
      try {
        const d = new Date(row.data_aquisicao as string | Date)
        if (!isNaN(d.getTime())) dataAquisicao = d.toISOString().split("T")[0]
      } catch (e) {
        console.error(`Error parsing date for asset ${row.id}:`, e)
      }
    }

    return {
      id: String(row.id),
      patrimonio: row.patrimonio,
      patrimonioProvisorio: row.patrimonio_provisorio || undefined,
      patrimonioTipo: row.patrimonio_tipo,
      descricao: row.descricao,
      categoria: row.categoria_slug,
      grupo: row.grupo || "Geral",
      localizacao: {
        secretaria: row.localizacao_secretaria,
        departamento: row.localizacao_departamento,
        sala: row.localizacao_sala,
      },
      responsavel: {
        nome: row.responsavel_nome,
        cargo: row.responsavel_cargo,
      },
      dataAquisicao,
      valor: Number(row.valor || 0),
      status: row.status,
      marca: row.marca || undefined,
      modelo: row.modelo || undefined,
      numeroSerie: row.numero_serie || undefined,
      estadoConservacao: row.estado_conservacao || undefined,
      observacoes: row.observacoes || undefined,
      imagem: row.imagem || undefined,
      placa: row.placa || undefined,
      ano: row.ano ? Number(row.ano) : undefined,
      kmAtual: row.km_atual ? Number(row.km_atual) : undefined,
      tempoGarantia: row.tempo_garantia ? Number(row.tempo_garantia) : undefined,
      fornecedor: row.fornecedor || undefined,
      notaFiscal: row.nota_fiscal_url || undefined,
      emendaParlamentar: row.emenda_parlamentar || undefined,
      tipoEntrada: row.tipo_entrada || "compra",
      etiquetaStatus: row.etiqueta_status ? String(row.etiqueta_status) as "pendente" | "enviada" | "colada" : null,
      etiquetaEnviadaEm: row.etiqueta_enviada_em ? new Date(row.etiqueta_enviada_em as string).toISOString() : undefined,
      etiquetaEnviadaPor: row.etiqueta_enviada_por ? String(row.etiqueta_enviada_por) : undefined,
      etiquetaColadaEm: row.etiqueta_colada_em ? new Date(row.etiqueta_colada_em as string).toISOString() : undefined,
      etiquetaColadaPor: row.etiqueta_colada_por ? String(row.etiqueta_colada_por) : undefined,
    }
  } catch (err) {
    console.error(`Error mapping asset row ${row.id}:`, err)
    return null
  }
}
