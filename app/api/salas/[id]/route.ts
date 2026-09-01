import { NextResponse } from "next/server"
import { execute, queryOne } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"
import { cacheDelByPrefix } from "@/lib/redis-tools"
import { SECRETARIAS_ALL_CACHE_KEY } from "@/lib/cache-keys"
import { canAccessDepartamentoId, canAccessSalaId } from "@/lib/asset-scope"

export const GET = withAuth(async (request, { user, params }) => {
  const id = params?.id
  if (!(await canAccessSalaId(user, id || ""))) {
    return NextResponse.json({ error: "Sem permissao para acessar esta sala" }, { status: 403 })
  }
  const sala = await queryOne("SELECT * FROM salas WHERE id = ?", [id])
  
  if (!sala) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 })
  }

  return NextResponse.json(sala)
})

export const PUT = withAuth(async (request, { user, params }) => {
  const id = params?.id
  if (!(await canAccessSalaId(user, id || ""))) {
    return NextResponse.json({ error: "Sem permissao para editar esta sala" }, { status: 403 })
  }
  const body = await request.json()
  
  if (!body.nome) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
  }

  const existing = await queryOne<{ nome: string; departamento_id: number }>("SELECT nome, departamento_id FROM salas WHERE id = ?", [id])
  
  if (existing && existing.nome !== body.nome) {
      await execute("UPDATE bens SET localizacao_sala = ? WHERE localizacao_sala = ?", [body.nome, existing.nome])
  }

  if (body.departamentoId) {
    if (!(await canAccessDepartamentoId(user, body.departamentoId))) {
      return NextResponse.json({ error: "Sem permissao para mover esta sala para o departamento informado" }, { status: 403 })
    }
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

  await cacheDelByPrefix(SECRETARIAS_ALL_CACHE_KEY)
  return NextResponse.json({ success: true })
})

export const DELETE = withAuth(async (_request, { user, params }) => {
  const id = params?.id
  if (!(await canAccessSalaId(user, id || ""))) {
    return NextResponse.json({ error: "Sem permissao para excluir esta sala" }, { status: 403 })
  }

  // Get sala, department and secretariat names
  const existing = await queryOne<{ nome: string; departamento_nome: string; secretaria_nome: string }>(
    `SELECT s.nome, d.nome as departamento_nome, sec.nome as secretaria_nome 
     FROM salas s 
     JOIN departamentos d ON s.departamento_id = d.id 
     JOIN secretarias sec ON d.secretaria_id = sec.id 
     WHERE s.id = ?`, 
    [id]
  )

  if (!existing) {
    return NextResponse.json({ error: "Sala não encontrada." }, { status: 404 })
  }

  // Check for usage in Assets
  const usage = await queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM bens WHERE localizacao_sala = ? AND localizacao_departamento = ? AND localizacao_secretaria = ?", 
    [existing.nome, existing.departamento_nome, existing.secretaria_nome]
  )

  if (usage && usage.count > 0) {
    return NextResponse.json({ 
      error: `Não é possível excluir a sala "${existing.nome}" pois ela possui ${usage.count} bem(ns) vinculado(s).` 
    }, { status: 400 })
  }

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

  await cacheDelByPrefix(SECRETARIAS_ALL_CACHE_KEY)
  return NextResponse.json({ success: true })
})
