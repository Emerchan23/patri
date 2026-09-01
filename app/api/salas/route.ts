
import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { appendScopeClause, getAssetScopeClause } from "@/lib/asset-scope"

export const GET = withAuth(async (request, { user }) => {
  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get("page")) || 1
  const limit = Number(searchParams.get("limit")) || 10
  const search = searchParams.get("search") || ""
  const secretariaId = searchParams.get("secretariaId")
  const departamentoId = searchParams.get("departamentoId")
  const offset = (page - 1) * limit

  const scope = getAssetScopeClause(user, {
    secretariaColumn: "sec.nome",
    departamentoColumn: "d.nome",
  })
  const baseWhere = appendScopeClause("WHERE 1=1", [], scope)
  let whereClause = baseWhere.whereClause
  const params: unknown[] = [...baseWhere.params]

  if (search) {
    whereClause += " AND s.nome LIKE ?"
    params.push(`%${search}%`)
  }

  if (secretariaId && secretariaId !== "todas") {
    whereClause += " AND d.secretaria_id = ?"
    params.push(secretariaId)
  }

  if (departamentoId && departamentoId !== "todos") {
    whereClause += " AND s.departamento_id = ?"
    params.push(departamentoId)
  }

  const countQuery = `
    SELECT COUNT(*) as total 
    FROM salas s
    JOIN departamentos d ON s.departamento_id = d.id
    JOIN secretarias sec ON d.secretaria_id = sec.id
    ${whereClause}
  `
  const countResult = await query<any>(countQuery, params)
  const total = countResult[0].total
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const dataQuery = `
    SELECT s.*, d.nome as departamento_nome, d.secretaria_id, sec.nome as secretaria_nome
    FROM salas s
    JOIN departamentos d ON s.departamento_id = d.id
    JOIN secretarias sec ON d.secretaria_id = sec.id
    ${whereClause}
    ORDER BY s.nome LIMIT ? OFFSET ?
  `
  const rows = await query<any>(dataQuery, [...params, limit, offset])

  const result = rows.map((row) => {
    return {
      id: Number(row.id),
      nome: row.nome,
      departamentoId: Number(row.departamento_id),
      departamento: row.departamento_nome,
      secretariaId: Number(row.secretaria_id),
      secretaria: row.secretaria_nome,
    }
  })

  return NextResponse.json({
    data: result,
    meta: {
      total,
      page,
      limit,
      totalPages
    }
  })
})
