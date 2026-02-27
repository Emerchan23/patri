import { NextResponse } from "next/server"
import { execute, query } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"

export const GET = withAuth(async (request, { params }) => {
  const departamentoId = params?.id
  const salas = await query("SELECT * FROM salas WHERE departamento_id = ?", [departamentoId])
  return NextResponse.json(salas)
})

export const POST = withAuth(async (request, { user, params }) => {
  const departamentoId = params?.id
  const body = await request.json()
  const result = await execute(
    "INSERT INTO salas (departamento_id, nome) VALUES (?, ?)",
    [departamentoId, body.nome]
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

  return NextResponse.json({ id: result.insertId }, { status: 201 })
})
