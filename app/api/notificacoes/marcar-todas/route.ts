import { NextRequest, NextResponse } from "next/server"
import { execute } from "@/lib/db"
import { verifyAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req)
  if (!user) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })

  const result = await execute(
    "UPDATE notificacoes SET lida = 1 WHERE usuario_id = ? AND lida = 0",
    [user.id]
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
      detalhes: "Marcadas como lidas em lote"
    })
  }

  return NextResponse.json({ ok: true })
}
