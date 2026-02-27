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

  const existing = await queryOne<{ nome: string; secretaria_id: number }>("SELECT nome, secretaria_id FROM departamentos WHERE id = ?", [id])

  if (body.secretariaId) {
    await execute("UPDATE departamentos SET nome = ?, secretaria_id = ? WHERE id = ?", [body.nome, body.secretariaId, id])
  } else {
    await execute("UPDATE departamentos SET nome = ? WHERE id = ?", [body.nome, id])
  }
  
  await registrarLog({
    acao: "edicao",
    descricao: `Departamento editado: ${body.nome}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "departamento",
    entidadeId: String(id),
    entidadeDescricao: body.nome,
    dadosAnteriores: existing ? { nome: existing.nome, secretaria_id: existing.secretaria_id } : undefined,
    dadosNovos: { nome: body.nome, secretaria_id: body.secretariaId }
  })

  return NextResponse.json({ success: true })
})

export const DELETE = withAuth(async (_request, { user, params }) => {
  const id = params?.id

  const existing = await queryOne<{ nome: string }>("SELECT nome FROM departamentos WHERE id = ?", [id])

  await execute("DELETE FROM departamentos WHERE id = ?", [id])

  await registrarLog({
    acao: "exclusao",
    descricao: `Departamento excluído: ${existing?.nome || id}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "departamento",
    entidadeId: String(id),
    entidadeDescricao: existing?.nome
  })

  return NextResponse.json({ success: true })
})
