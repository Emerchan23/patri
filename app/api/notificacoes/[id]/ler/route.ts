import { NextResponse } from "next/server"
import { execute, queryOne } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"

// PATCH /api/notificacoes/[id]/ler - Mark single notification as read
export const PATCH = withAuth(async (_request, { user, params }) => {
  const id = params?.id

  const existing = await queryOne<{ titulo: string }>("SELECT titulo FROM notificacoes WHERE id = ?", [id])

  await execute("UPDATE notificacoes SET lida = 1 WHERE id = ?", [id])

  if (existing) {
    await registrarLog({
      acao: "edicao",
      descricao: "Notificacao marcada como lida",
      usuarioId: user.id,
      usuarioNome: user.nome,
      usuarioRole: user.role,
      entidadeTipo: "notificacao",
      entidadeId: String(id),
      entidadeDescricao: existing.titulo,
      detalhes: "Marcada como lida individualmente"
    })
  }

  return NextResponse.json({ success: true })
})
