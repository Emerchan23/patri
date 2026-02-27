import { NextResponse } from "next/server"
import { execute, query } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"

export const GET = withAuth(async (request, { params }) => {
  const secretariaId = params?.id
  const departamentos = await query("SELECT * FROM departamentos WHERE secretaria_id = ?", [secretariaId])
  return NextResponse.json(departamentos)
})

export const POST = withAuth(async (request, { user, params }) => {
  const secretariaId = params?.id
  const body = await request.json()
  const result = await execute(
    "INSERT INTO departamentos (secretaria_id, nome) VALUES (?, ?)",
    [secretariaId, body.nome]
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

  return NextResponse.json({ id: result.insertId }, { status: 201 })
})
