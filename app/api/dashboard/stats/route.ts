import { NextResponse } from "next/server"
import { queryOne, query } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { cacheGetJson, cacheSetJson } from "@/lib/redis-tools"
import { appendScopeClause, getAssetScopeClause, getTransferScopeClause } from "@/lib/asset-scope"

// GET /api/dashboard/stats
export const GET = withAuth(async (request, { user }) => {
  const url = new URL(request.url)
  const unidade = url.searchParams.get("unidade") === "true"
  const secretariaFilter = url.searchParams.get("secretaria") || ""
  const cacheKey = [
    "cache:dashboard:stats:v1",
    user.id,
    user.role,
    unidade ? "1" : "0",
    user.unidade_secretaria || "",
    (user.departamentosAssistente || [user.unidade_departamento || ""]).filter(Boolean).join("|"),
    secretariaFilter,
  ].join(":")

  const cached = await cacheGetJson<any>(cacheKey)
  if (cached) return NextResponse.json(cached)

  const scoped = appendScopeClause("WHERE 1=1", [], getAssetScopeClause(user))
  let whereClause = scoped.whereClause
  const params: unknown[] = [...scoped.params]

  if (unidade && user.role === "assistente" && user.unidade_secretaria) {
    whereClause += " AND localizacao_secretaria = ?"
    params.push(user.unidade_secretaria)
  }

  if (secretariaFilter) {
    whereClause += " AND localizacao_secretaria = ?"
    params.push(secretariaFilter)
  }

  const total = await queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM bens ${whereClause}`, params)
  const ativos = await queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM bens ${whereClause} AND status = 'ativo'`, params)
  const emManutencao = await queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM bens ${whereClause} AND status = 'em_manutencao'`, params)
  const baixados = await queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM bens ${whereClause} AND status = 'baixado'`, params)
  const provisoriosCount = await queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM bens ${whereClause} AND patrimonio_tipo = 'provisorio'`, params)
  const valorTotal = await queryOne<{ total: number }>(`SELECT COALESCE(SUM(valor), 0) as total FROM bens ${whereClause}`, params)
  const veiculos = await queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM bens ${whereClause} AND categoria_slug = 'veiculo'`, params)
  
  // Lists for dashboard
  const provisoriosList = await query(
    `SELECT id, descricao, patrimonio as numero_patrimonio, patrimonio_provisorio as numero_provisorio, categoria_slug as categoria, localizacao_departamento as departamento 
     FROM bens ${whereClause} AND patrimonio_tipo = 'provisorio' 
     ORDER BY criado_em DESC LIMIT 5`,
    params
  )

  const movRecentesList = await query(
    `SELECT m.id, m.bem_descricao, m.de_departamento, m.para_departamento, m.responsavel, m.data as data_movimentacao 
     FROM movimentacoes m 
     ${appendScopeClause("WHERE 1=1", [], getTransferScopeClause(user, {
       fromSecretariaColumn: "m.de_secretaria",
       fromDepartamentoColumn: "m.de_departamento",
       toSecretariaColumn: "m.para_secretaria",
       toDepartamentoColumn: "m.para_departamento",
     })).whereClause}
     ORDER BY m.data DESC, m.criado_em DESC LIMIT 5`,
    appendScopeClause("WHERE 1=1", [], getTransferScopeClause(user, {
      fromSecretariaColumn: "m.de_secretaria",
      fromDepartamentoColumn: "m.de_departamento",
      toSecretariaColumn: "m.para_secretaria",
      toDepartamentoColumn: "m.para_departamento",
    })).params
  )

  const loanScoped = appendScopeClause("WHERE 1=1", [], getTransferScopeClause(user, {
    fromSecretariaColumn: "origem_secretaria",
    fromDepartamentoColumn: "origem_departamento",
    toSecretariaColumn: "destino_secretaria",
    toDepartamentoColumn: "destino_departamento",
  }))
  const emprestimosAtivos = await queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM emprestimos ${loanScoped.whereClause} AND status = 'ativo'`, loanScoped.params)
  const emprestimosAtrasados = await queryOne<{ count: number }>(`SELECT COUNT(*) as count FROM emprestimos ${loanScoped.whereClause} AND status = 'atrasado'`, loanScoped.params)

  // Stats per category
  const porCategoria = await query<{ categoria_slug: string; count: number; total: number }>(
    `SELECT categoria_slug, COUNT(*) as count, COALESCE(SUM(valor), 0) as total FROM bens ${whereClause} GROUP BY categoria_slug`,
    params
  )

  // Stats per secretariat
  const porSecretaria = await query<{ localizacao_secretaria: string; count: number; total: number }>(
    `SELECT localizacao_secretaria, COUNT(*) as count, COALESCE(SUM(valor), 0) as total FROM bens ${whereClause} GROUP BY localizacao_secretaria`,
    params
  )

  // Stats per department (if secretariat selected)
  let porDepartamento: any[] = []
  if (secretariaFilter) {
    const deptWhere = whereClause
    const deptParams = [...params]
    porDepartamento = await query<{ localizacao_departamento: string; count: number; total: number }>(
      `SELECT localizacao_departamento, COUNT(*) as count, COALESCE(SUM(valor), 0) as total FROM bens ${deptWhere} GROUP BY localizacao_departamento`,
      deptParams
    )
  }

  const response = {
    totalBens: total?.count || 0,
    totalAtivos: ativos?.count || 0,
    totalManutencao: emManutencao?.count || 0,
    totalBaixados: baixados?.count || 0,
    totalProvisorio: provisoriosCount?.count || 0,
    valorTotal: Number(valorTotal?.total || 0),
    totalVeiculos: veiculos?.count || 0,
    movimentacoesRecentes: movRecentesList || [],
    provisorios: provisoriosList || [],
    emprestimosAtivos: emprestimosAtivos?.count || 0,
    emprestimosAtrasados: emprestimosAtrasados?.count || 0,
    porCategoria: porCategoria.map((c) => ({
      categoria: c.categoria_slug,
      quantidade: c.count,
      valorTotal: Number(c.total),
    })),
    porSecretaria: porSecretaria.map((s) => ({
      secretaria: s.localizacao_secretaria,
      quantidade: s.count,
      valorTotal: Number(s.total),
    })),
    porDepartamento: porDepartamento.map((d) => ({
      departamento: d.localizacao_departamento,
      quantidade: d.count,
      valorTotal: Number(d.total),
    })),
  }

  await cacheSetJson(cacheKey, response, 30)
  return NextResponse.json(response)
})
