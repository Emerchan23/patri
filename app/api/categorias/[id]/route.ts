import { NextResponse } from "next/server"
import { execute, queryOne } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"

// PUT /api/categorias/[id]
export const PUT = withAuth(async (request, { user, params }) => {
  const id = params?.id
  const body = await request.json()
  const slug = (body.nome as string).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
  
  const existing = await queryOne<{ nome: string; descricao: string }>("SELECT nome, descricao FROM categorias WHERE id = ?", [id])
  
  await execute("UPDATE categorias SET nome=?, slug=?, descricao=? WHERE id=?", [body.nome, slug, body.descricao || null, id])

  await registrarLog({
    acao: "edicao",
    descricao: `Categoria editada: ${body.nome}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "categoria",
    entidadeId: String(id),
    entidadeDescricao: body.nome,
    dadosAnteriores: existing ? { nome: existing.nome, descricao: existing.descricao } : undefined,
    dadosNovos: { nome: body.nome, descricao: body.descricao }
  })

  return NextResponse.json({ success: true })
})

// DELETE /api/categorias/[id]
export const DELETE = withAuth(async (_request, { user, params }) => {
  const id = params?.id
  
  const existing = await queryOne<{ nome: string }>("SELECT nome FROM categorias WHERE id = ?", [id])

  await execute("DELETE FROM categorias WHERE id = ?", [id])

  await registrarLog({
    acao: "exclusao",
    descricao: `Categoria excluída: ${existing?.nome || id}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "categoria",
    entidadeId: String(id),
    entidadeDescricao: existing?.nome
  })

  return NextResponse.json({ success: true })
})
