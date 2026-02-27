import { NextResponse } from "next/server"
import { query, execute } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"

// GET /api/secretarias - Full hierarchy
export const GET = withAuth(async () => {
  const secs = await query<Record<string, unknown>>("SELECT * FROM secretarias ORDER BY nome")
  const deps = await query<Record<string, unknown>>("SELECT * FROM departamentos ORDER BY nome")
  const salas = await query<Record<string, unknown>>("SELECT * FROM salas ORDER BY nome")

  const result = secs.map((sec) => {
    const secDeps = deps.filter((d) => d.secretaria_id === sec.id)
    return {
      id: sec.id,
      nome: sec.nome,
      departamentos: secDeps.map((dep) => {
        const depSalas = salas.filter((s) => s.departamento_id === dep.id)
        return {
          id: dep.id,
          nome: dep.nome,
          salas: depSalas.map((s) => ({ id: s.id, nome: s.nome })),
        }
      }),
    }
  })

  return NextResponse.json(result)
})

// POST /api/secretarias
export const POST = withAuth(async (request, { user }) => {
  const body = await request.json()
  const result = await execute("INSERT INTO secretarias (nome) VALUES (?)", [body.nome])

  await registrarLog({
    acao: "cadastro",
    descricao: `Secretaria criada: ${body.nome}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "secretaria",
    entidadeId: String(result.insertId),
    entidadeDescricao: body.nome,
  })

  return NextResponse.json({ id: result.insertId }, { status: 201 })
})
