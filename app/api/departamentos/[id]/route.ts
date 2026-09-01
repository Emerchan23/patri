import { NextResponse } from "next/server"
import { execute, queryOne } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"
import { cacheDelByPrefix } from "@/lib/redis-tools"
import { SECRETARIAS_ALL_CACHE_KEY } from "@/lib/cache-keys"
import { canAccessDepartamentoId, canAccessSecretariaId } from "@/lib/asset-scope"

export const PUT = withAuth(async (request, { user, params }) => {
  const id = params?.id
  if (!(await canAccessDepartamentoId(user, id || ""))) {
    return NextResponse.json({ error: "Sem permissao para editar este departamento" }, { status: 403 })
  }
  const body = await request.json()
  
  if (!body.nome) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
  }

  const existing = await queryOne<{ nome: string; secretaria_id: number }>("SELECT nome, secretaria_id FROM departamentos WHERE id = ?", [id])
  
  if (existing && existing.nome !== body.nome) {
      await execute("UPDATE bens SET localizacao_departamento = ? WHERE localizacao_departamento = ?", [body.nome, existing.nome])
  }

  if (body.secretariaId) {
    if (!(await canAccessSecretariaId(user, body.secretariaId))) {
      return NextResponse.json({ error: "Sem permissao para mover este departamento para a secretaria informada" }, { status: 403 })
    }
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

  await cacheDelByPrefix(SECRETARIAS_ALL_CACHE_KEY)
  return NextResponse.json({ success: true })
})

export const DELETE = withAuth(async (_request, { user, params }) => {
  const id = params?.id
  if (!(await canAccessDepartamentoId(user, id || ""))) {
    return NextResponse.json({ error: "Sem permissao para excluir este departamento" }, { status: 403 })
  }

  // Get department and its secretariat name
  const existing = await queryOne<{ nome: string; secretaria_nome: string }>(
    `SELECT d.nome, s.nome as secretaria_nome 
     FROM departamentos d 
     JOIN secretarias s ON d.secretaria_id = s.id 
     WHERE d.id = ?`, 
    [id]
  )

  if (!existing) {
    return NextResponse.json({ error: "Departamento não encontrado." }, { status: 404 })
  }

  // Check for usage in Assets
  const usage = await queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM bens WHERE localizacao_departamento = ? AND localizacao_secretaria = ?", 
    [existing.nome, existing.secretaria_nome]
  )

  if (usage && usage.count > 0) {
    return NextResponse.json({ 
      error: `Não é possível excluir o departamento "${existing.nome}" pois ele possui ${usage.count} bem(ns) vinculado(s).` 
    }, { status: 400 })
  }

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

  await cacheDelByPrefix(SECRETARIAS_ALL_CACHE_KEY)
  return NextResponse.json({ success: true })
})
