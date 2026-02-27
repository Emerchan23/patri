import { NextResponse } from "next/server"
import { query, execute } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"
import { criarNotificacao } from "@/lib/notifications"

// GET /api/movimentacoes
export const GET = withAuth(async (request) => {
  const url = new URL(request.url)
  const secretaria = url.searchParams.get("secretaria")
  const periodo = url.searchParams.get("periodo")
  const bemId = url.searchParams.get("bem_id")
  const busca = url.searchParams.get("busca")
  
  const page = parseInt(url.searchParams.get("page") || "1")
  const limit = parseInt(url.searchParams.get("limit") || "20")
  const offset = (page - 1) * limit

  let whereClause = "WHERE 1=1"
  const params: unknown[] = []

  if (secretaria) {
    whereClause += " AND (m.de_secretaria = ? OR m.para_secretaria = ?)"
    params.push(secretaria, secretaria)
  }

  if (periodo) {
    const days = parseInt(periodo)
    if (!isNaN(days)) {
      whereClause += " AND m.data >= DATE_SUB(CURDATE(), INTERVAL ? DAY)"
      params.push(days)
    }
  }

  if (bemId) {
    whereClause += " AND m.bem_id = ?"
    params.push(bemId)
  }

  if (busca) {
    whereClause += " AND (m.bem_descricao LIKE ? OR m.patrimonio LIKE ? OR m.responsavel LIKE ? OR m.de_departamento LIKE ? OR m.para_departamento LIKE ?)"
    const term = `%${busca}%`
    params.push(term, term, term, term, term)
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
export const POST = withAuth(async (request, { user }) => {
  const body = await request.json()

  // Insert movement record
  const result = await execute(
    `INSERT INTO movimentacoes (bem_id, bem_descricao, patrimonio, de_secretaria, de_departamento, de_sala,
     para_secretaria, para_departamento, para_sala, responsavel, data, motivo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      body.assetId || null, body.assetDescricao, body.patrimonio,
      body.de?.secretaria || null, body.de?.departamento || null, body.de?.sala || null,
      body.para?.secretaria || null, body.para?.departamento || null, body.para?.sala || null,
      body.responsavel, body.data || new Date(), body.motivo,
    ]
  )

  // Update asset location
  if (body.assetId) {
    await execute(
      `UPDATE bens SET localizacao_secretaria = ?, localizacao_departamento = ?, localizacao_sala = ? WHERE id = ?`,
      [body.para?.secretaria, body.para?.departamento, body.para?.sala, body.assetId]
    )
  }

  await registrarLog({
    acao: "transferencia",
    descricao: `Transferencia: ${body.assetDescricao} - ${body.de?.departamento} para ${body.para?.departamento}`,
    detalhes: `Motivo: ${body.motivo}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "movimentacao",
    entidadeId: String(result.insertId),
    entidadeDescricao: body.assetDescricao,
    dadosAnteriores: { secretaria: body.de?.secretaria, departamento: body.de?.departamento, sala: body.de?.sala },
    dadosNovos: { secretaria: body.para?.secretaria, departamento: body.para?.departamento, sala: body.para?.sala },
  })

  await criarNotificacao({
    roleDestino: "assistente",
    titulo: "Movimentacao registrada",
    mensagem: `${body.assetDescricao} foi transferido para ${body.para?.departamento}.`,
    tipo: "info",
    link: "movimentacoes",
  })

  return NextResponse.json({ id: result.insertId }, { status: 201 })
})
