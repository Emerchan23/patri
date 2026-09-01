import { NextResponse } from "next/server"
import { execute, queryOne } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"

export const DELETE = withAuth(async (request, { params, user }) => {
  const { id } = params as { id: string }

  const existing = await queryOne<{ nome: string }>("SELECT nome FROM fornecedores WHERE id = ?", [id])
  
  if (!existing) {
    return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 })
  }

  // Check for usage in Assets
  const usage = await queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM bens WHERE fornecedor = ?", 
    [existing.nome]
  )

  if (usage && usage.count > 0) {
    return NextResponse.json({ 
      error: `Não é possível excluir o fornecedor "${existing.nome}" pois ele está vinculado a ${usage.count} bem(ns).` 
    }, { status: 400 })
  }

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
