import { NextResponse } from "next/server"
import { queryOne, query } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"

// GET /api/dashboard/stats
export const GET = withAuth(async (request, { user }) => {
  const url = new URL(request.url)
  const unidade = url.searchParams.get("unidade") === "true"

  let whereClause = "WHERE 1=1"
  const params: unknown[] = []

  // For assistente, only their unit
  if (unidade && user.role === "assistente" && user.unidade_secretaria) {
    whereClause += " AND localizacao_secretaria = ? AND localizacao_departamento = ?"
    params.push(user.unidade_secretaria, user.unidade_departamento)
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
     ORDER BY m.data DESC, m.criado_em DESC LIMIT 5`,
    []
  )

  const emprestimosAtivos = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM emprestimos WHERE status = 'ativo'", [])
  const emprestimosAtrasados = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM emprestimos WHERE status = 'atrasado'", [])

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
  const secretariaFilter = url.searchParams.get("secretaria")
  if (secretariaFilter) {
    const deptWhere = whereClause + " AND localizacao_secretaria = ?"
    const deptParams = [...params, secretariaFilter]
    porDepartamento = await query<{ localizacao_departamento: string; count: number; total: number }>(
      `SELECT localizacao_departamento, COUNT(*) as count, COALESCE(SUM(valor), 0) as total FROM bens ${deptWhere} GROUP BY localizacao_departamento`,
      deptParams
    )
  }

  return NextResponse.json({
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
  })
})
