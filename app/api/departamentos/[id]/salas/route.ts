import { NextResponse } from "next/server"
import { execute, query } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"
import { cacheDelByPrefix } from "@/lib/redis-tools"
import { SECRETARIAS_ALL_CACHE_KEY } from "@/lib/cache-keys"
import { canAccessDepartamentoId } from "@/lib/asset-scope"

export const GET = withAuth(async (request, { user, params }) => {
  const departamentoId = params?.id
  if (!(await canAccessDepartamentoId(user, departamentoId || ""))) {
    return NextResponse.json({ error: "Sem permissao para acessar este departamento" }, { status: 403 })
  }
  const salas = await query("SELECT * FROM salas WHERE departamento_id = ?", [departamentoId])
  return NextResponse.json(salas)
})

export const POST = withAuth(async (request, { user, params }) => {
  const departamentoId = params?.id
  if (!(await canAccessDepartamentoId(user, departamentoId || ""))) {
    return NextResponse.json({ error: "Sem permissao para cadastrar neste departamento" }, { status: 403 })
  }
  const body = await request.json()

  if (!body.nome) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
  }

  // Check duplicate in this department
  const existing = await query<any[]>(
    "SELECT id FROM salas WHERE departamento_id = ? AND LOWER(nome) = LOWER(?)", 
    [departamentoId, body.nome.trim()]
  )
  if (existing.length > 0) {
    return NextResponse.json({ error: "Sala com este nome já existe neste departamento." }, { status: 409 })
  }

  const result = await execute(
    "INSERT INTO salas (departamento_id, nome) VALUES (?, ?)",
    [departamentoId, body.nome.trim()]
  )

  await registrarLog({
    acao: "cadastro",
    descricao: `Sala criada: ${body.nome}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "sala",
    entidadeId: String(result.insertId),
    entidadeDescricao: body.nome,
    detalhes: `Departamento ID: ${departamentoId}`
  })

  await cacheDelByPrefix(SECRETARIAS_ALL_CACHE_KEY)
  return NextResponse.json({ id: result.insertId }, { status: 201 })
})
