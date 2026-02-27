import { NextResponse } from "next/server"
import { query, execute } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"
import { criarNotificacao } from "@/lib/notifications"

// GET /api/emprestimos
export const GET = withAuth(async (request) => {
  const url = new URL(request.url)
  const status = url.searchParams.get("status")
  const busca = url.searchParams.get("busca")
  
  const page = parseInt(url.searchParams.get("page") || "1")
  const limit = parseInt(url.searchParams.get("limit") || "20")
  const offset = (page - 1) * limit

  let whereClause = "WHERE 1=1"
  const params: unknown[] = []

  if (status) {
    whereClause += " AND e.status = ?"
    params.push(status)
  }

  if (busca) {
    whereClause += " AND (e.bem_descricao LIKE ? OR e.patrimonio LIKE ? OR e.destino_secretaria LIKE ? OR e.responsavel_recebimento LIKE ?)"
    const term = `%${busca}%`
    params.push(term, term, term, term)
  }

  // Count total records and stats
  const countSql = `
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'ativo' THEN 1 ELSE 0 END) as ativos,
      SUM(CASE WHEN status = 'atrasado' THEN 1 ELSE 0 END) as atrasados,
      SUM(CASE WHEN status = 'devolvido' THEN 1 ELSE 0 END) as devolvidos
    FROM emprestimos e ${whereClause.replace('WHERE 1=1', 'WHERE 1=1')}
  `
  const countResult = await query(countSql, params) as any[]
  const total = countResult[0]?.total || 0
  const stats = {
    ativos: Number(countResult[0]?.ativos || 0),
    atrasados: Number(countResult[0]?.atrasados || 0),
    devolvidos: Number(countResult[0]?.devolvidos || 0),
    total
  }
  const totalPages = Math.ceil(total / limit)

  // Get paginated data
  let sql = `
    SELECT e.*, b.imagem as assetImagem 
    FROM emprestimos e
    LEFT JOIN bens b ON e.bem_id = b.id
    ${whereClause} 
    ORDER BY e.criado_em DESC 
    LIMIT ? OFFSET ?
  `
  params.push(limit, offset)

  const rows = await query(sql, params)
  const loans = (rows as Record<string, unknown>[]).map(dbRowToLoan)

  return NextResponse.json({
    data: loans,
    meta: {
      total,
      stats,
      page,
      limit,
      totalPages
    }
  })
})

// POST /api/emprestimos
export const POST = withAuth(async (request, { user }) => {
  const body = await request.json()

  const result = await execute(
    `INSERT INTO emprestimos (bem_id, bem_descricao, patrimonio, origem_secretaria, origem_departamento, origem_sala,
     destino_secretaria, destino_departamento, destino_sala, responsavel_emprestimo, responsavel_recebimento,
     data_emprestimo, data_prevista_devolucao, motivo, observacoes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativo')`,
    [
      body.assetId || null, body.assetDescricao, body.patrimonio,
      body.origem?.secretaria, body.origem?.departamento, body.origem?.sala,
      body.destino?.secretaria, body.destino?.departamento, body.destino?.sala,
      body.responsavelEmprestimo, body.responsavelRecebimento,
      body.dataEmprestimo, body.dataPrevistaDevolucao,
      body.motivo, body.observacoes || null,
    ]
  )

  // Update asset status to emprestado
  if (body.assetId) {
    await execute("UPDATE bens SET status = 'emprestado' WHERE id = ?", [body.assetId])
  }

  await registrarLog({
    acao: "emprestimo",
    descricao: `Emprestimo registrado: ${body.assetDescricao}`,
    detalhes: `De ${body.origem?.departamento} para ${body.destino?.departamento}. Motivo: ${body.motivo}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "emprestimo",
    entidadeId: String(result.insertId),
    entidadeDescricao: body.assetDescricao,
  })

  await criarNotificacao({
    roleDestino: "gestor",
    titulo: "Novo emprestimo registrado",
    mensagem: `${body.assetDescricao} emprestado para ${body.destino?.departamento}.`,
    tipo: "info",
    link: "emprestimos",
  })

  return NextResponse.json({ id: result.insertId }, { status: 201 })
})

function dbRowToLoan(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    assetId: String(row.bem_id),
    assetDescricao: row.bem_descricao,
    assetImagem: row.assetImagem,
    patrimonio: row.patrimonio,
    origem: { secretaria: row.origem_secretaria, departamento: row.origem_departamento, sala: row.origem_sala },
    destino: { secretaria: row.destino_secretaria, departamento: row.destino_departamento, sala: row.destino_sala },
    responsavelEmprestimo: row.responsavel_emprestimo,
    responsavelRecebimento: row.responsavel_recebimento,
    solicitante: row.solicitante,
    dataEmprestimo: row.data_emprestimo ? new Date(row.data_emprestimo as string).toISOString().split("T")[0] : "",
    dataPrevistaDevolucao: row.data_prevista_devolucao ? new Date(row.data_prevista_devolucao as string).toISOString().split("T")[0] : "",
    dataDevolucao: row.data_devolucao ? new Date(row.data_devolucao as string).toISOString().split("T")[0] : undefined,
    motivo: row.motivo,
    observacoes: row.observacoes || undefined,
    status: row.status,
  }
}
