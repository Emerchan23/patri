import { NextResponse } from "next/server"
import { execute, queryOne } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"

// PUT /api/categorias/[id]
export const PUT = withAuth(async (request, { user, params }) => {
  const id = params?.id
  const body = await request.json()
  const slug = (body.nome as string).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
  
  const existing = await queryOne<{ nome: string; descricao: string; slug: string }>("SELECT nome, slug, descricao FROM categorias WHERE id = ?", [id])
  
  // Cascading update for bens if slug changes
  if (existing && existing.slug !== slug) {
      await execute("UPDATE bens SET categoria_slug = ? WHERE categoria_slug = ?", [slug, existing.slug])
  }

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
  
  const existing = await queryOne<{ nome: string; slug: string }>("SELECT nome, slug FROM categorias WHERE id = ?", [id])

  if (!existing) {
    return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 })
  }

  // Check for usage in Assets
  const usage = await queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM bens WHERE categoria_slug = ?", 
    [existing.slug]
  )

  if (usage && usage.count > 0) {
    return NextResponse.json({ 
      error: `Não é possível excluir a categoria "${existing.nome}" pois ela está vinculada a ${usage.count} bem(ns).` 
    }, { status: 400 })
  }

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
