import { NextResponse } from "next/server"
import { execute, queryOne } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"

export const PUT = withAuth(async (request, { user, params }) => {
  const id = params?.id
  const body = await request.json()
  
  if (!body.nome) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
  }

  const existing = await queryOne<{ nome: string }>("SELECT nome FROM secretarias WHERE id = ?", [id])

  await execute("UPDATE secretarias SET nome = ? WHERE id = ?", [body.nome, id])

  await registrarLog({
    acao: "edicao",
    descricao: `Secretaria editada: ${body.nome}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "secretaria",
    entidadeId: String(id),
    entidadeDescricao: body.nome,
    dadosAnteriores: existing ? { nome: existing.nome } : undefined,
    dadosNovos: { nome: body.nome }
  })

  return NextResponse.json({ success: true })
})

export const DELETE = withAuth(async (_request, { user, params }) => {
  const id = params?.id
  
  const existing = await queryOne<{ nome: string }>("SELECT nome FROM secretarias WHERE id = ?", [id])

  await execute("DELETE FROM secretarias WHERE id = ?", [id])

  await registrarLog({
    acao: "exclusao",
    descricao: `Secretaria excluída: ${existing?.nome || id}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "secretaria",
    entidadeId: String(id),
    entidadeDescricao: existing?.nome
  })

  return NextResponse.json({ success: true })
})
