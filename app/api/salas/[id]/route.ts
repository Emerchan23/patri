import { NextResponse } from "next/server"
import { execute, queryOne } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"

export const GET = withAuth(async (request, { params }) => {
  const id = params?.id
  const sala = await queryOne("SELECT * FROM salas WHERE id = ?", [id])
  
  if (!sala) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 })
  }

  return NextResponse.json(sala)
})

export const PUT = withAuth(async (request, { user, params }) => {
  const id = params?.id
  const body = await request.json()
  
  if (!body.nome) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
  }

  const existing = await queryOne<{ nome: string; departamento_id: number }>("SELECT nome, departamento_id FROM salas WHERE id = ?", [id])

  if (body.departamentoId) {
    await execute("UPDATE salas SET nome = ?, departamento_id = ? WHERE id = ?", [body.nome, body.departamentoId, id])
  } else {
    await execute("UPDATE salas SET nome = ? WHERE id = ?", [body.nome, id])
  }
  
  await registrarLog({
    acao: "edicao",
    descricao: `Sala editada: ${body.nome}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "sala",
    entidadeId: String(id),
    entidadeDescricao: body.nome,
    dadosAnteriores: existing ? { nome: existing.nome, departamento_id: existing.departamento_id } : undefined,
    dadosNovos: { nome: body.nome, departamento_id: body.departamentoId }
  })

  return NextResponse.json({ success: true })
})

export const DELETE = withAuth(async (_request, { user, params }) => {
  const id = params?.id

  const existing = await queryOne<{ nome: string }>("SELECT nome FROM salas WHERE id = ?", [id])

  await execute("DELETE FROM salas WHERE id = ?", [id])

  await registrarLog({
    acao: "exclusao",
    descricao: `Sala excluída: ${existing?.nome || id}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "sala",
    entidadeId: String(id),
    entidadeDescricao: existing?.nome
  })

  return NextResponse.json({ success: true })
})
