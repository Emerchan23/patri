
import { NextResponse } from "next/server"
import { query, execute } from "@/lib/db"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const busca = searchParams.get("busca")

    let sql = "SELECT * FROM servidores WHERE 1=1"
    const params: any[] = []

    if (busca) {
      sql += " AND (nome LIKE ? OR cargo LIKE ? OR cpf LIKE ?)"
      const term = `%${busca}%`
      params.push(term, term, term)
    }

    sql += " ORDER BY nome ASC"

    const servidores = await query(sql, params)

    return NextResponse.json(servidores)
  } catch (error) {
    console.error("Erro ao listar servidores:", error)
    return NextResponse.json(
      { error: "Erro ao listar servidores" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nome, cargo, cpf } = body

    if (!nome || !cargo) {
      return NextResponse.json(
        { error: "Nome e cargo são obrigatórios" },
        { status: 400 }
      )
    }

    const result = await execute(
      "INSERT INTO servidores (nome, cargo, cpf) VALUES (?, ?, ?)",
      [nome, cargo, cpf || null]
    )

    return NextResponse.json({
      id: result.insertId,
      nome,
      cargo,
      cpf,
    })
  } catch (error) {
    console.error("Erro ao criar servidor:", error)
    return NextResponse.json(
      { error: "Erro ao criar servidor" },
      { status: 500 }
    )
  }
}
