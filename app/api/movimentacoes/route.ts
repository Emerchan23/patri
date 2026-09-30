import { NextResponse } from "next/server"
import { query, withTransaction } from "@/lib/db"
import { withAuth, withPermission } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"
import { criarNotificacao } from "@/lib/notifications"
import { appendScopeClause, getTransferScopeClause, isLocationInScope } from "@/lib/asset-scope"
import { registrarMovimentacaoInterna } from "@/lib/movimentacao-service"
import { buildSmartSearch } from "@/lib/smart-search"
import { sameLocation } from "@/lib/location-match"

// GET /api/movimentacoes
export const GET = withAuth(async (request, { user }) => {
  const url = new URL(request.url)
  const secretaria = url.searchParams.get("secretaria")
  const departamento = url.searchParams.get("departamento")
  const sala = url.searchParams.get("sala")
  const periodo = url.searchParams.get("periodo")
  const bemId = url.searchParams.get("bem_id")
  const busca = url.searchParams.get("busca")
  const responsavel = url.searchParams.get("responsavel")
  
  const page = parseInt(url.searchParams.get("page") || "1")
  const limit = parseInt(url.searchParams.get("limit") || "20")
  const offset = (page - 1) * limit

  let whereClause = "WHERE 1=1"
  const params: unknown[] = []
  const scoped = appendScopeClause(whereClause, params, getTransferScopeClause(user, {
    fromSecretariaColumn: "m.de_secretaria",
    fromDepartamentoColumn: "m.de_departamento",
    toSecretariaColumn: "m.para_secretaria",
    toDepartamentoColumn: "m.para_departamento",
  }))
  whereClause = scoped.whereClause
  params.push(...scoped.params)

  if (secretaria) {
    whereClause += " AND (m.de_secretaria = ? OR m.para_secretaria = ?)"
    params.push(secretaria, secretaria)
  }

  if (departamento) {
    whereClause += " AND (m.de_departamento = ? OR m.para_departamento = ?)"
    params.push(departamento, departamento)
  }

  if (sala) {
    whereClause += " AND (m.de_sala = ? OR m.para_sala = ?)"
    params.push(sala, sala)
  }

  if (periodo) {
    if (periodo === "mes_atual") {
      whereClause += " AND YEAR(m.data) = YEAR(CURDATE()) AND MONTH(m.data) = MONTH(CURDATE())"
    } else {
      const days = parseInt(periodo)
      if (!isNaN(days)) {
        whereClause += " AND m.data >= DATE_SUB(CURDATE(), INTERVAL ? DAY)"
        params.push(days)
      }
    }
  }

  if (responsavel) {
    whereClause += " AND m.responsavel LIKE ?"
    params.push(`%${responsavel}%`)
  }

  if (bemId) {
    whereClause += " AND m.bem_id = ?"
    params.push(bemId)
  }

  if (busca) {
    const smart = buildSmartSearch(["m.bem_descricao", "m.patrimonio", "m.responsavel", "m.motivo", "m.de_secretaria", "m.de_departamento", "m.de_sala", "m.para_secretaria", "m.para_departamento", "m.para_sala"], busca)
    whereClause += ` AND ${smart.clause}`
    params.push(...smart.params)
  }

  // Count total records
  const countSql = `SELECT COUNT(*) as total FROM movimentacoes m ${whereClause.replace('WHERE 1=1', 'WHERE 1=1')}`
  const countResult = await query(countSql, params) as any[]
  const total = countResult[0]?.total || 0
  const totalPages = Math.ceil(total / limit)

  // Get paginated data
  let sql = `
    SELECT m.*, b.imagem as assetImagem 
    FROM movimentacoes m 
    LEFT JOIN bens b ON m.bem_id = b.id 
    ${whereClause} 
    ORDER BY m.data DESC, m.criado_em DESC 
    LIMIT ? OFFSET ?
  `
  params.push(limit, offset)

  const rows = await query(sql, params)
  const movements = (rows as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    assetId: String(row.bem_id),
    assetDescricao: row.bem_descricao,
    assetImagem: row.assetImagem,
    patrimonio: row.patrimonio,
    de: { secretaria: row.de_secretaria, departamento: row.de_departamento, sala: row.de_sala },
    para: { secretaria: row.para_secretaria, departamento: row.para_departamento, sala: row.para_sala },
    responsavel: row.responsavel,
    data: row.data ? new Date(row.data as string).toISOString().split("T")[0] : "",
    motivo: row.motivo,
  }))

  return NextResponse.json({
    data: movements,
    meta: {
      total,
      page,
      limit,
      totalPages
    }
  })
})

// POST /api/movimentacoes
export const POST = withPermission("registrarMovimentacao", async (request, { user }) => {
  const body = await request.json()
  const requestedDestination = body?.para
  if (
    !requestedDestination ||
    !["secretaria", "departamento", "sala"].every(
      (field) => typeof requestedDestination[field] === "string" && requestedDestination[field].trim(),
    )
  ) {
    return NextResponse.json({ error: "Selecione secretaria, departamento e sala de destino" }, { status: 400 })
  }
  if (typeof body?.motivo !== "string" || !body.motivo.trim()) {
    return NextResponse.json({ error: "Motivo e obrigatorio" }, { status: 400 })
  }
  const destination = {
    secretaria: requestedDestination.secretaria.trim(),
    departamento: requestedDestination.departamento.trim(),
    sala: requestedDestination.sala.trim(),
  }
  if (!isLocationInScope(user, destination)) {
    return NextResponse.json({ error: "Sem permissao para movimentar bem para este destino" }, { status: 403 })
  }

  const requestedAssetIds: string[] = Array.isArray(body.assetIds)
    ? body.assetIds.map((id: unknown) => String(id)).filter(Boolean)
    : body.assetId
      ? [String(body.assetId)]
      : []
  const assetIds = Array.from(new Set(requestedAssetIds))

  if (assetIds.length === 0) {
    return NextResponse.json({ error: "Selecione pelo menos um bem para movimentar" }, { status: 400 })
  }

  const placeholders = assetIds.map(() => "?").join(", ")
  const transaction = await withTransaction(async (connection) => {
    const [rows] = await connection.execute(
      `SELECT id, descricao, patrimonio, patrimonio_provisorio,
              localizacao_secretaria, localizacao_departamento, localizacao_sala
         FROM bens
        WHERE id IN (${placeholders})
        ORDER BY id
        FOR UPDATE`,
      assetIds,
    )
    const assetRows = rows as Array<{
      id: number
      descricao: string
      patrimonio: string | null
      patrimonio_provisorio: string | null
      localizacao_secretaria: string | null
      localizacao_departamento: string | null
      localizacao_sala: string | null
    }>
    const assetsById = new Map(assetRows.map((asset) => [String(asset.id), asset]))
    if (assetsById.size !== assetIds.length) return { error: "missing" as const }
    if (
      assetRows.some(
        (asset) =>
          !isLocationInScope(user, {
            secretaria: asset.localizacao_secretaria,
            departamento: asset.localizacao_departamento,
          }),
      )
    ) return { error: "forbidden" as const }
    if (
      assetRows.some(
        (asset) => sameLocation(
          {
            secretaria: asset.localizacao_secretaria,
            departamento: asset.localizacao_departamento,
            sala: asset.localizacao_sala,
          },
          destination,
        ),
      )
    ) return { error: "already_there" as const }

    const movementResults = []
    for (const assetId of assetIds) {
      const asset = assetsById.get(assetId)
      if (!asset) continue
      movementResults.push(await registrarMovimentacaoInterna(connection, {
        assetId,
        assetDescricao: asset.descricao,
        patrimonio: asset.patrimonio || asset.patrimonio_provisorio || "",
        de: {
          secretaria: asset.localizacao_secretaria,
          departamento: asset.localizacao_departamento,
          sala: asset.localizacao_sala,
        },
        para: destination,
        responsavel: user.nome,
        motivo: body.motivo,
        data: body.data,
      }))
    }
    return { results: movementResults, assetsById }
  })

  if ("error" in transaction) {
    if (transaction.error === "missing") {
      return NextResponse.json({ error: "Um ou mais bens selecionados não foram encontrados" }, { status: 404 })
    }
    if (transaction.error === "forbidden") {
      return NextResponse.json({ error: "Sem permissao para movimentar um dos bens selecionados" }, { status: 403 })
    }
    return NextResponse.json({ error: "Um ou mais bens ja estao no local de destino" }, { status: 400 })
  }

  const { results, assetsById } = transaction

  for (let index = 0; index < results.length; index += 1) {
    const asset = assetsById.get(assetIds[index])
    if (!asset) continue
    await registrarLog({
      acao: "transferencia",
      descricao: `Transferencia: ${asset.descricao} - ${asset.localizacao_departamento || ""} para ${destination.departamento || ""}`,
      detalhes: `Movimentação conjunta com ${results.length} bem(ns). Motivo: ${body.motivo}`,
      usuarioId: user.id,
      usuarioNome: user.nome,
      usuarioRole: user.role,
      entidadeTipo: "movimentacao",
      entidadeId: String(results[index].insertId),
      entidadeDescricao: asset.descricao,
      dadosAnteriores: { secretaria: asset.localizacao_secretaria, departamento: asset.localizacao_departamento, sala: asset.localizacao_sala },
      dadosNovos: { secretaria: destination.secretaria, departamento: destination.departamento, sala: destination.sala },
    })
  }

  await criarNotificacao({
    roleDestino: "assistente",
    titulo: "Movimentacao registrada",
    mensagem: `${results.length} bem(ns) foram transferidos para ${destination.departamento}.`,
    tipo: "info",
    link: "movimentacoes",
  })

  return NextResponse.json({
    id: results[0]?.insertId,
    ids: results.map((result) => result.insertId),
    count: results.length,
  }, { status: 201 })
})
