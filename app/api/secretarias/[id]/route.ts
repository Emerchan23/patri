import { NextResponse } from "next/server"
import { execute, queryOne } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"
import { cacheDelByPrefix } from "@/lib/redis-tools"
import { SECRETARIAS_ALL_CACHE_KEY } from "@/lib/cache-keys"
import { canAccessSecretariaId } from "@/lib/asset-scope"

export const PUT = withAuth(async (request, { user, params }) => {
  const id = params?.id
  if (!(await canAccessSecretariaId(user, id || ""))) {
    return NextResponse.json({ error: "Sem permissao para editar esta secretaria" }, { status: 403 })
  }
  const body = await request.json()
  
  if (!body.nome) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
  }

  const existing = await queryOne<{ nome: string }>("SELECT nome FROM secretarias WHERE id = ?", [id])
  
  if (existing && existing.nome !== body.nome) {
      await execute("UPDATE bens SET localizacao_secretaria = ? WHERE localizacao_secretaria = ?", [body.nome, existing.nome])
  }

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

  await cacheDelByPrefix(SECRETARIAS_ALL_CACHE_KEY)
  return NextResponse.json({ success: true })
})

export const DELETE = withAuth(async (_request, { user, params }) => {
  const id = params?.id
  if (!(await canAccessSecretariaId(user, id || ""))) {
    return NextResponse.json({ error: "Sem permissao para excluir esta secretaria" }, { status: 403 })
  }
  
  const existing = await queryOne<{ nome: string }>("SELECT nome FROM secretarias WHERE id = ?", [id])

  if (!existing) {
    return NextResponse.json({ error: "Secretaria não encontrada." }, { status: 404 })
  }

  // Check for usage in Assets
  const usage = await queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM bens WHERE localizacao_secretaria = ?", 
    [existing.nome]
  )

  if (usage && usage.count > 0) {
    return NextResponse.json({ 
      error: `Não é possível excluir a secretaria "${existing.nome}" pois ela possui ${usage.count} bem(ns) vinculado(s).` 
    }, { status: 400 })
  }

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

  await cacheDelByPrefix(SECRETARIAS_ALL_CACHE_KEY)
  return NextResponse.json({ success: true })
})
