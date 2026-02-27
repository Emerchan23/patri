import { NextResponse } from "next/server"
import { execute } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"

export const DELETE = withAuth(async (request, { params, user }) => {
  const { id } = params as { id: string }
  await execute("DELETE FROM fornecedores WHERE id = ?", [id])

  await registrarLog({
    acao: "exclusao",
    descricao: `Fornecedor excluido: ID ${id}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "fornecedor",
    entidadeId: id
  })

  return NextResponse.json({ success: true })
})
