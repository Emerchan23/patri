import { NextResponse } from "next/server"
import { query, execute } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"

export const GET = withAuth(async () => {
  const rows = await query("SELECT * FROM marcas ORDER BY nome")
  const marcas = (rows as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    nome: row.nome,
  }))
  return NextResponse.json(marcas)
})

export const POST = withAuth(async (request, { user }) => {
  const body = await request.json()
  
  if (!body.nome) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
  }

  try {
    const result = await execute("INSERT INTO marcas (nome) VALUES (?)", [body.nome])

    await registrarLog({
      acao: "cadastro",
      descricao: `Marca criada: ${body.nome}`,
      usuarioId: user.id,
      usuarioNome: user.nome,
      usuarioRole: user.role,
      entidadeTipo: "marca",
      entidadeId: String(result.insertId),
      entidadeDescricao: body.nome
    })

    return NextResponse.json({ id: result.insertId }, { status: 201 })
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: "Marca já cadastrada." }, { status: 409 })
    }
    console.error("Erro ao criar marca:", error)
    return NextResponse.json({ error: "Erro ao criar marca." }, { status: 500 })
  }
})
