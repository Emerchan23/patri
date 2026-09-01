import { NextResponse } from "next/server"
import { execute, query } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"
import { cacheDelByPrefix } from "@/lib/redis-tools"
import { SECRETARIAS_ALL_CACHE_KEY } from "@/lib/cache-keys"
import { canAccessSecretariaId } from "@/lib/asset-scope"

export const GET = withAuth(async (request, { user, params }) => {
  const secretariaId = params?.id
  if (!(await canAccessSecretariaId(user, secretariaId || ""))) {
    return NextResponse.json({ error: "Sem permissao para acessar esta secretaria" }, { status: 403 })
  }
  const departamentos = await query("SELECT * FROM departamentos WHERE secretaria_id = ?", [secretariaId])
  return NextResponse.json(departamentos)
})

export const POST = withAuth(async (request, { user, params }) => {
  const secretariaId = params?.id
  if (!(await canAccessSecretariaId(user, secretariaId || ""))) {
    return NextResponse.json({ error: "Sem permissao para cadastrar nesta secretaria" }, { status: 403 })
  }
  const body = await request.json()

  if (!body.nome) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
  }

  // Check duplicate in this secretariat
  const existing = await query<any[]>(
    "SELECT id FROM departamentos WHERE secretaria_id = ? AND LOWER(nome) = LOWER(?)", 
    [secretariaId, body.nome.trim()]
  )
  if (existing.length > 0) {
    return NextResponse.json({ error: "Departamento com este nome já existe nesta secretaria." }, { status: 409 })
  }

  const result = await execute(
    "INSERT INTO departamentos (secretaria_id, nome) VALUES (?, ?)",
    [secretariaId, body.nome.trim()]
  )

  await registrarLog({
    acao: "cadastro",
    descricao: `Departamento criado: ${body.nome}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "departamento",
    entidadeId: String(result.insertId),
    entidadeDescricao: body.nome,
    detalhes: `Secretaria ID: ${secretariaId}`
  })

  await cacheDelByPrefix(SECRETARIAS_ALL_CACHE_KEY)
  return NextResponse.json({ id: result.insertId }, { status: 201 })
})
