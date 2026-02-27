import { NextResponse } from "next/server"
import { query, execute } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"

export const GET = withAuth(async () => {
  const rows = await query("SELECT * FROM grupos ORDER BY nome")
  return NextResponse.json(rows)
})

export const POST = withAuth(async (req: Request) => {
  const body = await req.json()
  const { nome } = body
  
  if (!nome) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
  }

  try {
    const result = await execute("INSERT INTO grupos (nome) VALUES (?)", [nome])
    return NextResponse.json({ id: (result as any).insertId, nome }, { status: 201 })
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
       return NextResponse.json({ error: "Grupo já existe" }, { status: 409 })
    }
    return NextResponse.json({ error: "Erro ao criar grupo" }, { status: 500 })
  }
})
