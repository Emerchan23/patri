import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { verifyAuth } from "@/lib/api-auth"
import { appendScopeClause, getAssetScopeClause, getTransferScopeClause } from "@/lib/asset-scope"
import { ensureAssetLabelWorkflowSchema } from "@/lib/asset-label-workflow-schema"
import { buildSmartSearch } from "@/lib/smart-search"

function normalizePage(value: string | null, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export async function GET(req: NextRequest) {
  await ensureAssetLabelWorkflowSchema()
  const user = await verifyAuth(req)
  if (!user) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })

  const url = new URL(req.url)
  const page = normalizePage(url.searchParams.get("page"), 1)
  const limit = Math.min(normalizePage(url.searchParams.get("limit"), 20), 5000)
  const offset = (page - 1) * limit
  const search = (url.searchParams.get("search") || "").trim()
  const secretaria = (url.searchParams.get("secretaria") || "").trim()
  const departamento = (url.searchParams.get("departamento") || "").trim()
  const sala = (url.searchParams.get("sala") || "").trim()

  const scope = getAssetScopeClause(user, {
    secretariaColumn: "localizacao_secretaria",
    departamentoColumn: "localizacao_departamento",
  })
  const loanScope = getTransferScopeClause(user, {
    fromSecretariaColumn: "origem_secretaria",
    fromDepartamentoColumn: "origem_departamento",
    toSecretariaColumn: "destino_secretaria",
    toDepartamentoColumn: "destino_departamento",
  })

  let baseWhere = "WHERE status = 'ativo' AND ((patrimonio IS NULL OR patrimonio = '' OR patrimonio LIKE 'PROV%' OR patrimonio_tipo = 'provisorio') OR etiqueta_status = 'enviada')"
  let baseParams: unknown[] = []
  const scopedBase = appendScopeClause(baseWhere, baseParams, scope)
  baseWhere = scopedBase.whereClause
  baseParams = scopedBase.params

  if (secretaria && secretaria !== "todos") {
    baseWhere += " AND localizacao_secretaria = ?"
    baseParams.push(secretaria)
  }

  if (departamento && departamento !== "todos") {
    baseWhere += " AND localizacao_departamento = ?"
    baseParams.push(departamento)
  }

  if (sala && sala !== "todos") {
    baseWhere += " AND localizacao_sala = ?"
    baseParams.push(sala)
  }

  let dataWhere = baseWhere
  const dataParams = [...baseParams]
  if (search) {
    const smart = buildSmartSearch(["descricao", "patrimonio", "patrimonio_provisorio", "responsavel_nome", "localizacao_secretaria", "localizacao_departamento", "localizacao_sala"], search)
    dataWhere += ` AND ${smart.clause}`
    dataParams.push(...smart.params)
  }

  const [rows, countResult, statsResult, pendingList, semLocal, mauEstado, atrasados] = await Promise.all([
    query<any>(
       `SELECT
         id,
         patrimonio,
         patrimonio_provisorio,
         patrimonio_tipo,
         descricao,
         categoria_slug,
         localizacao_secretaria,
         localizacao_departamento,
         localizacao_sala,
         responsavel_nome,
         responsavel_cargo,
         data_aquisicao,
         valor,
         status,
         marca,
         modelo,
         numero_serie,
         imagem,
         emenda_parlamentar,
         etiqueta_status,
         etiqueta_enviada_em,
         etiqueta_enviada_por,
         etiqueta_colada_em,
         etiqueta_colada_por
       FROM bens
       ${dataWhere}
       ORDER BY data_aquisicao ASC, id ASC
       LIMIT ? OFFSET ?`,
      [...dataParams, limit, offset]
    ),
    query<{ total: number }>(
      `SELECT COUNT(*) as total
         FROM bens
        ${dataWhere}`,
      dataParams
    ),
    query<{
      total: number
      menosDe30: number
      entre30e60: number
      maisDe60: number
    }>(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN DATEDIFF(CURDATE(), data_aquisicao) < 30 THEN 1 ELSE 0 END) as menosDe30,
         SUM(CASE WHEN DATEDIFF(CURDATE(), data_aquisicao) >= 30 AND DATEDIFF(CURDATE(), data_aquisicao) < 60 THEN 1 ELSE 0 END) as entre30e60,
         SUM(CASE WHEN DATEDIFF(CURDATE(), data_aquisicao) >= 60 THEN 1 ELSE 0 END) as maisDe60
       FROM bens
      ${baseWhere}`,
      baseParams
    ),
    query<any>(
      `SELECT id, descricao, patrimonio as numero_patrimonio, localizacao_secretaria as secretaria, localizacao_departamento as departamento, localizacao_sala as sala, estado_conservacao as estado
         FROM bens
        ${baseWhere}`,
      baseParams
    ),
    query<any>(
      `SELECT id, descricao, patrimonio as numero_patrimonio, localizacao_secretaria as secretaria, localizacao_departamento as departamento, localizacao_sala as sala, estado_conservacao as estado
         FROM bens
        WHERE status = 'ativo'
          AND (localizacao_secretaria IS NULL OR localizacao_secretaria = '' OR localizacao_departamento IS NULL OR localizacao_departamento = '')
          ${scope.clause ? `AND (${scope.clause})` : ""}`,
      scope.params
    ),
    query<any>(
      `SELECT id, descricao, patrimonio as numero_patrimonio, localizacao_secretaria as secretaria, localizacao_departamento as departamento, localizacao_sala as sala, estado_conservacao as estado
         FROM bens
        WHERE status = 'ativo'
          AND estado_conservacao IN ('ruim', 'inoperante')
          ${scope.clause ? `AND (${scope.clause})` : ""}`,
      scope.params
    ),
    query<any>(
      `SELECT id, bem_descricao, responsavel_recebimento as responsavel, data_emprestimo, data_prevista_devolucao as data_devolucao_prevista
         FROM emprestimos
        WHERE status = 'ativo'
          AND data_prevista_devolucao < CURDATE()
          ${loanScope.clause ? `AND (${loanScope.clause})` : ""}`,
      loanScope.params
    ),
  ])

  const total = Number(countResult[0]?.total || 0)
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const stats = statsResult[0] || { total: 0, menosDe30: 0, entre30e60: 0, maisDe60: 0 }

  const data = rows.map((row) => ({
    id: String(row.id),
    patrimonio: row.patrimonio,
    patrimonioProvisorio: row.patrimonio_provisorio || undefined,
    patrimonioTipo: row.patrimonio_tipo,
    descricao: row.descricao,
    categoria: row.categoria_slug,
    localizacao: {
      secretaria: row.localizacao_secretaria,
      departamento: row.localizacao_departamento,
      sala: row.localizacao_sala,
    },
    responsavel: {
      nome: row.responsavel_nome,
      cargo: row.responsavel_cargo,
    },
    dataAquisicao: row.data_aquisicao ? new Date(row.data_aquisicao).toISOString().split("T")[0] : "",
    valor: Number(row.valor || 0),
    status: row.status,
    marca: row.marca || undefined,
    modelo: row.modelo || undefined,
    numeroSerie: row.numero_serie || undefined,
    imagem: row.imagem || undefined,
    emendaParlamentar: row.emenda_parlamentar || undefined,
    etiquetaStatus: row.etiqueta_status ? String(row.etiqueta_status) as "pendente" | "enviada" | "colada" : null,
    etiquetaEnviadaEm: row.etiqueta_enviada_em ? new Date(row.etiqueta_enviada_em).toISOString() : undefined,
    etiquetaEnviadaPor: row.etiqueta_enviada_por || undefined,
    etiquetaColadaEm: row.etiqueta_colada_em ? new Date(row.etiqueta_colada_em).toISOString() : undefined,
    etiquetaColadaPor: row.etiqueta_colada_por || undefined,
  }))

  return NextResponse.json({
    data,
    meta: {
      total,
      page,
      limit,
      totalPages,
    },
    totals: {
      total: Number(stats.total || 0),
      menosDe30: Number(stats.menosDe30 || 0),
      entre30e60: Number(stats.entre30e60 || 0),
      maisDe60: Number(stats.maisDe60 || 0),
      semPlaqueta: pendingList.length,
      semLocal: semLocal.length,
      mauEstado: mauEstado.length,
      atrasados: atrasados.length,
    },
    semPlaqueta: pendingList,
    semLocal,
    mauEstado,
    atrasados,
  })
}
