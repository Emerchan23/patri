import { NextResponse } from "next/server"
import { execute, queryOne } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"

export const PUT = withAuth(async (request, { user, params }) => {
  const id = params?.id
  const body = await request.json()
  
  const existing = await queryOne<{ nome: string }>("SELECT nome FROM marcas WHERE id = ?", [id])
  
  if (existing && existing.nome !== body.nome) {
      await execute("UPDATE bens SET marca = ? WHERE marca = ?", [body.nome, existing.nome])
  }

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

  if (!existing) {
    return NextResponse.json({ error: "Marca não encontrada." }, { status: 404 })
  }

  // Check for usage in Assets
  const usage = await queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM bens WHERE marca = ?", 
    [existing.nome]
  )

  if (usage && usage.count > 0) {
    return NextResponse.json({ 
      error: `Não é possível excluir a marca "${existing.nome}" pois ela está vinculada a ${usage.count} bem(ns). Remova o vínculo dos bens antes de excluir.` 
    }, { status: 400 })
  }

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
