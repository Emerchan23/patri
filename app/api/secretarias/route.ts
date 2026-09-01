import { NextResponse } from "next/server"
import { query, execute } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"
import { cacheDelByPrefix, cacheGetJson, cacheSetJson } from "@/lib/redis-tools"
import { SECRETARIAS_ALL_CACHE_KEY } from "@/lib/cache-keys"

// GET /api/secretarias - Full hierarchy (Paginated)
export const GET = withAuth(async (request, { user }) => {
  const { searchParams } = new URL(request.url)
  const managedSecretarias = user.role === "gestor" ? new Set(user.secretariasGerenciadas || []) : null
  const assistantSecretaria = user.role === "assistente" ? user.unidade_secretaria : null
  
  // If "all" param is present, return all data (legacy mode for dropdowns)
  if (searchParams.get("all") === "true") {
    const cacheKey =
      user.role === "administrador"
        ? SECRETARIAS_ALL_CACHE_KEY
        : `${SECRETARIAS_ALL_CACHE_KEY}:${user.role}:${user.id}`
    const cached = await cacheGetJson<any[]>(cacheKey)
    if (cached) return NextResponse.json(cached)

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
    }).filter((sec) => {
      if (user.role === "administrador") return true
      if (user.role === "gestor") return managedSecretarias?.has(String(sec.nome)) || managedSecretarias?.has(sec.nome as string)
      return sec.nome === assistantSecretaria
    })
    await cacheSetJson(cacheKey, result, 300)
    return NextResponse.json(result)
  }

  // Pagination logic
  const page = Number(searchParams.get("page")) || 1
  const limit = Number(searchParams.get("limit")) || 10
  const search = searchParams.get("search") || ""
  const offset = (page - 1) * limit

  let countQuery = "SELECT COUNT(*) as total FROM secretarias"
  let dataQuery = "SELECT * FROM secretarias"
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

  // Get paginated secretarias
  const secs = await query<any>(dataQuery, [...params, limit, offset])
  
  // Get departments and rooms ONLY for the fetched secretarias to optimize
  const secIds = secs.map(s => s.id)
  let deps: Record<string, unknown>[] = []
  let salas: Record<string, unknown>[] = []

  if (secIds.length > 0) {
    const placeholders = secIds.map(() => '?').join(',')
    deps = await query<any>(
      `SELECT * FROM departamentos WHERE secretaria_id IN (${placeholders}) ORDER BY nome`,
      secIds
    )

    const depIds = deps.map(d => d.id)
    if (depIds.length > 0) {
      const depPlaceholders = depIds.map(() => '?').join(',')
      salas = await query<any>(
        `SELECT * FROM salas WHERE departamento_id IN (${depPlaceholders}) ORDER BY nome`,
        depIds
      )
    }
  }

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
  }).filter((sec) => {
    if (user.role === "administrador") return true
    if (user.role === "gestor") return managedSecretarias?.has(String(sec.nome)) || managedSecretarias?.has(sec.nome as string)
    return sec.nome === assistantSecretaria
  })

  const filteredTotal = result.length

  return NextResponse.json({
    data: result,
    meta: {
      total: filteredTotal,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(filteredTotal / limit))
    }
  })
})

// POST /api/secretarias
export const POST = withAuth(async (request, { user }) => {
  const body = await request.json()

  if (!body.nome) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
  }

  // Check duplicate
  const existing = await query<any[]>("SELECT id FROM secretarias WHERE LOWER(nome) = LOWER(?)", [body.nome.trim()])
  if (existing.length > 0) {
    return NextResponse.json({ error: "Secretaria com este nome já existe." }, { status: 409 })
  }

  const result = await execute("INSERT INTO secretarias (nome) VALUES (?)", [body.nome.trim()])

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

  await cacheDelByPrefix(SECRETARIAS_ALL_CACHE_KEY)
  return NextResponse.json({ id: result.insertId }, { status: 201 })
})
