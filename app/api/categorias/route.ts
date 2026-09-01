import { NextResponse } from "next/server"
import { query, execute } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"

// GET /api/categorias
export const GET = withAuth(async (request) => {
  const { searchParams } = new URL(request.url)

  if (searchParams.get("all") === "true") {
    const rows = await query<any>("SELECT * FROM categorias ORDER BY nome")
    const categorias = rows.map((row) => ({
      id: String(row.id),
      nome: row.nome,
      slug: row.slug,
      descricao: row.descricao || undefined,
    }))
    return NextResponse.json(categorias)
  }

  const page = Number(searchParams.get("page")) || 1
  const limit = Number(searchParams.get("limit")) || 10
  const search = searchParams.get("search") || ""
  const offset = (page - 1) * limit

  let countQuery = "SELECT COUNT(*) as total FROM categorias"
  let dataQuery = "SELECT * FROM categorias"
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
  
  const categorias = rows.map((row) => ({
    id: String(row.id),
    nome: row.nome,
    slug: row.slug,
    descricao: row.descricao || undefined,
  }))

  return NextResponse.json({
    data: categorias,
    meta: {
      total,
      page,
      limit,
      totalPages
    }
  })
})

// POST /api/categorias
export const POST = withAuth(async (request, { user }) => {
  const body = await request.json()
  const slug = (body.nome as string).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "")
  
  try {
    const result = await execute(
      "INSERT INTO categorias (nome, slug, descricao) VALUES (?, ?, ?)",
      [body.nome, slug, body.descricao || null]
    )

    await registrarLog({
      acao: "cadastro",
      descricao: `Categoria criada: ${body.nome}`,
      usuarioId: user.id,
      usuarioNome: user.nome,
      usuarioRole: user.role,
      entidadeTipo: "categoria",
      entidadeId: String(result.insertId),
      entidadeDescricao: body.nome,
      detalhes: body.descricao
    })

    return NextResponse.json({ id: result.insertId, slug }, { status: 201 })
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: "Categoria já cadastrada." }, { status: 409 })
    }
    console.error("Erro ao criar categoria:", error)
    return NextResponse.json({ error: "Erro ao criar categoria." }, { status: 500 })
  }
})
