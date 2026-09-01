import { NextResponse } from "next/server"
import { query, execute, queryOne } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"

export const GET = withAuth(async (request) => {
  const { searchParams } = new URL(request.url)

  if (searchParams.get("all") === "true") {
    const rows = await query<any>("SELECT * FROM marcas ORDER BY nome")
    const marcas = rows.map((row) => ({
      id: String(row.id),
      nome: row.nome,
    }))
    return NextResponse.json(marcas)
  }

  const page = Number(searchParams.get("page")) || 1
  const limit = Number(searchParams.get("limit")) || 10
  const search = searchParams.get("search") || ""
  const offset = (page - 1) * limit

  let countQuery = "SELECT COUNT(*) as total FROM marcas"
  let dataQuery = "SELECT * FROM marcas"
  const params: any[] = []

  if (search) {
    const searchClause = " WHERE nome LIKE ?"
    countQuery += searchClause
    dataQuery += searchClause
    params.push(`%${search}%`)
  }

  dataQuery += " ORDER BY nome LIMIT ? OFFSET ?"
  
  // Get total count
  const countResult = await query<any>(countQuery, params)
  const total = countResult[0].total
  const totalPages = Math.ceil(total / limit)

  // Get data
  const rows = await query<any>(dataQuery, [...params, limit, offset])
  
  const marcas = rows.map((row) => ({
    id: String(row.id),
    nome: row.nome,
  }))

  return NextResponse.json({
    data: marcas,
    meta: {
      total,
      page,
      limit,
      totalPages
    }
  })
})

export const POST = withAuth(async (request, { user }) => {
  const body = await request.json()
  
  if (!body.nome) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
  }

  try {
    // Check for duplicate name (case-insensitive)
    const existing = await queryOne<{ id: number }>(
      "SELECT id FROM marcas WHERE LOWER(nome) = LOWER(?)", 
      [body.nome.trim()]
    )
    
    if (existing) {
      return NextResponse.json({ error: "Marca já cadastrada com este nome." }, { status: 409 })
    }

    const result = await execute("INSERT INTO marcas (nome) VALUES (?)", [body.nome.trim()])

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
