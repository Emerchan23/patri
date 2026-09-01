
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
  const offset = (page - 1) * limit

  const scope = getAssetScopeClause(user, {
    secretariaColumn: "s.nome",
    departamentoColumn: "d.nome",
  })
  const baseWhere = appendScopeClause("WHERE 1=1", [], scope)
  let whereClause = baseWhere.whereClause
  const params: unknown[] = [...baseWhere.params]

  if (search) {
    whereClause += " AND d.nome LIKE ?"
    params.push(`%${search}%`)
  }

  if (secretariaId && secretariaId !== "todas") {
    whereClause += " AND d.secretaria_id = ?"
    params.push(secretariaId)
  }

  const countQuery = `
    SELECT COUNT(*) as total
    FROM departamentos d
    JOIN secretarias s ON d.secretaria_id = s.id
    ${whereClause}
  `
  const countResult = await query<any>(countQuery, params)
  const total = countResult[0].total
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const dataQuery = `
    SELECT d.*, s.nome as secretaria_nome, (SELECT COUNT(*) FROM salas WHERE departamento_id = d.id) as salas_count
    FROM departamentos d 
    JOIN secretarias s ON d.secretaria_id = s.id
    ${whereClause}
    ORDER BY d.nome LIMIT ? OFFSET ?
  `
  const rows = await query<any>(dataQuery, [...params, limit, offset])

  const result = await Promise.all(rows.map(async (row) => {
    const salas = await query("SELECT id, nome FROM salas WHERE departamento_id = ? ORDER BY nome", [row.id])

    return {
      id: Number(row.id),
      nome: row.nome,
      secretariaId: Number(row.secretaria_id),
      secretaria: row.secretaria_nome,
      salas: salas.map((s: any) => ({ id: s.id, nome: s.nome }))
    }
  }))

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
