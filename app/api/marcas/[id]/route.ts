import { NextResponse } from "next/server"
import { execute, queryOne } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"

export const PUT = withAuth(async (request, { user, params }) => {
  const id = params?.id
  const body = await request.json()
  
  const existing = await queryOne<{ nome: string }>("SELECT nome FROM marcas WHERE id = ?", [id])

  await execute("UPDATE marcas SET nome=? WHERE id=?", [body.nome, id])

  await registrarLog({
    acao: "edicao",
    descricao: `Marca editada: ${body.nome}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "marca",
    entidadeId: String(id),
    entidadeDescricao: body.nome,
    dadosAnteriores: existing ? { nome: existing.nome } : undefined,
    dadosNovos: { nome: body.nome }
  })

  return NextResponse.json({ success: true })
})

export const DELETE = withAuth(async (_request, { user, params }) => {
  const id = params?.id

  const existing = await queryOne<{ nome: string }>("SELECT nome FROM marcas WHERE id = ?", [id])

  await execute("DELETE FROM marcas WHERE id = ?", [id])

  await registrarLog({
    acao: "exclusao",
    descricao: `Marca excluída: ${existing?.nome || id}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "marca",
    entidadeId: String(id),
    entidadeDescricao: existing?.nome
  })

  return NextResponse.json({ success: true })
})
