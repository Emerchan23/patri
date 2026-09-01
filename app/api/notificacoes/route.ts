import { NextResponse } from "next/server"
import { query, execute } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"

// GET /api/notificacoes - Get notifications for current user
export const GET = withAuth(async (request, { user }) => {
  const url = new URL(request.url)
  const countOnly = url.searchParams.get("count") === "true"

  // Build query: notifications for this specific user OR for their role hierarchy OR for everyone
  // Define role hierarchy for visibility
  const visibleRoles = [user.role]
  if (user.role === 'administrador') {
    visibleRoles.push('gestor', 'assistente')
  } else if (user.role === 'gestor') {
    visibleRoles.push('assistente')
  }

  // Create placeholders for IN clause
  const rolePlaceholders = visibleRoles.map(() => '?').join(',')
  
  const sql = countOnly
    ? `SELECT COUNT(*) as count FROM notificacoes
       WHERE lida = 0 AND (usuario_id = ? OR role_destino IN (${rolePlaceholders}) OR (usuario_id IS NULL AND role_destino IS NULL))`
    : `SELECT * FROM notificacoes
       WHERE (usuario_id = ? OR role_destino IN (${rolePlaceholders}) OR (usuario_id IS NULL AND role_destino IS NULL))
       ORDER BY criado_em DESC LIMIT 20`

  const params = [user.id, ...visibleRoles]

  if (countOnly) {
    const result = await query<{ count: number }>(sql, params)
    return NextResponse.json({ count: result[0]?.count || 0 })
  }

  const rows = await query(sql, params)
  const notificacoes = (rows as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    titulo: row.titulo,
    mensagem: row.mensagem,
    tipo: row.tipo,
    lida: Boolean(row.lida),
    link: row.link || undefined,
    criadoEm: row.criado_em,
  }))

  return NextResponse.json(notificacoes)
})

// PATCH /api/notificacoes - Mark all as read
export const PATCH = withAuth(async (_request, { user }) => {
  // Define role hierarchy for visibility
  const visibleRoles = [user.role]
  if (user.role === 'administrador') {
    visibleRoles.push('gestor', 'assistente')
  } else if (user.role === 'gestor') {
    visibleRoles.push('assistente')
  }

  // Create placeholders for IN clause
  const rolePlaceholders = visibleRoles.map(() => '?').join(',')

  const result = await execute(
    `UPDATE notificacoes SET lida = 1
     WHERE lida = 0 AND (usuario_id = ? OR role_destino IN (${rolePlaceholders}) OR (usuario_id IS NULL AND role_destino IS NULL))`,
    [user.id, ...visibleRoles]
  )

  if (result.affectedRows > 0) {
    await registrarLog({
      acao: "edicao",
      descricao: "Notificacoes marcadas como lidas",
      usuarioId: user.id,
      usuarioNome: user.nome,
      usuarioRole: user.role,
      entidadeTipo: "notificacao",
      entidadeDescricao: `${result.affectedRows} notificacoes`,
      detalhes: "Todas marcadas como lidas"
    })
  }

  return NextResponse.json({ success: true })
})
