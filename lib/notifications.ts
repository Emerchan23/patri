import { execute } from "./db"

interface NotificacaoParams {
  usuarioId?: number | null
  roleDestino?: string | null
  titulo: string
  mensagem: string
  tipo?: "info" | "warning" | "success" | "error"
  link?: string | null
}

export async function criarNotificacao(params: NotificacaoParams) {
  try {
    await execute(
      `INSERT INTO notificacoes (usuario_id, role_destino, titulo, mensagem, tipo, link)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        params.usuarioId || null,
        params.roleDestino || null,
        params.titulo,
        params.mensagem,
        params.tipo || "info",
        params.link || null,
      ]
    )
  } catch (error) {
    console.error("Erro ao criar notificacao:", error)
  }
}
