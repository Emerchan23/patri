import { NextResponse } from "next/server"
import { query, execute } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"

export const GET = withAuth(async (request) => {
  const { searchParams } = new URL(request.url)
  const isAll = searchParams.get("all") === "true"

  if (isAll) {
    let rows = await query("SELECT * FROM grupos ORDER BY nome")

    // Auto-sync: Se a tabela grupos estiver vazia, popular com os grupos existentes na tabela bens
    if (rows.length === 0) {
      try {
        await execute(`
          INSERT INTO grupos (nome) 
          SELECT DISTINCT grupo 
          FROM bens 
          WHERE grupo IS NOT NULL 
          AND grupo != ''
        `)
        // Busca novamente após sincronizar
        rows = await query("SELECT * FROM grupos ORDER BY nome")
      } catch (error) {
        console.error("Erro ao sincronizar grupos automaticamente:", error)
      }
    }

    return NextResponse.json(rows)
  }

  // Pagination logic
  const page = Number(searchParams.get("page")) || 1
  const limit = Number(searchParams.get("limit")) || 10
  const search = searchParams.get("search") || ""
  const offset = (page - 1) * limit

  let countQuery = "SELECT COUNT(*) as total FROM grupos"
  let dataQuery = "SELECT * FROM grupos"
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

  // Get paginated data
  const rows = await query<any>(dataQuery, [...params, limit, offset])

  return NextResponse.json({
    data: rows,
    meta: {
      total,
      page,
      limit,
      totalPages
    }
  })
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

export const PUT = withAuth(async (req: Request) => {
    // This is a placeholder since Next.js App Router uses dynamic routes for ID ([id]/route.ts)
    // But sometimes client calls PUT /api/grupos with ID in body? No, client calls /api/grupos/[id] usually.
    // The client code uses api.put(`/grupos/${editingItem.id}`, ...)
    // So we need [id]/route.ts for PUT/DELETE.
    // However, the previous code for POST was in this file.
    // Let's check if [id] folder exists for grupos.
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
})
