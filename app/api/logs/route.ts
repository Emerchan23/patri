import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { withRole } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"

// GET /api/logs
export const GET = withRole(["administrador"], async (request) => {
  const url = new URL(request.url)
  const acao = url.searchParams.get("acao")
  const usuario = url.searchParams.get("usuario")
  const busca = url.searchParams.get("busca")
  const dataInicio = url.searchParams.get("dataInicio")
  const dataFim = url.searchParams.get("dataFim")
  const limit = parseInt(url.searchParams.get("limit") || "300")
  const page = parseInt(url.searchParams.get("page") || "1")
  const offset = (page - 1) * limit

  let sqlCount = "SELECT COUNT(*) as total FROM audit_logs WHERE 1=1"
  let sql = "SELECT * FROM audit_logs WHERE 1=1"
  const params: unknown[] = []

  if (acao) {
    sql += " AND acao = ?"
    sqlCount += " AND acao = ?"
    params.push(acao)
  }

  if (usuario) {
    sql += " AND usuario_nome LIKE ?"
    sqlCount += " AND usuario_nome LIKE ?"
    params.push(`%${usuario}%`)
  }

  if (busca) {
    sql += " AND (descricao LIKE ? OR detalhes LIKE ? OR entidade_descricao LIKE ?)"
    sqlCount += " AND (descricao LIKE ? OR detalhes LIKE ? OR entidade_descricao LIKE ?)"
    const term = `%${busca}%`
    params.push(term, term, term)
  }

  if (dataInicio) {
    sql += " AND data_hora >= ?"
    sqlCount += " AND data_hora >= ?"
    params.push(dataInicio)
  }

  if (dataFim) {
    sql += " AND data_hora <= ?"
    sqlCount += " AND data_hora <= ?"
    params.push(dataFim + " 23:59:59")
  }

  const countResult = await query(sqlCount, params)
  const totalItems = (countResult as any[])[0].total

  sql += " ORDER BY data_hora DESC LIMIT ? OFFSET ?"
  params.push(limit, offset)

  const rows = await query(sql, params)
  const logs = (rows as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    acao: row.acao,
    descricao: row.descricao,
    detalhes: row.detalhes || undefined,
    usuario: {
      id: String(row.usuario_id),
      nome: row.usuario_nome,
      role: row.usuario_role,
    },
    entidade: row.entidade_tipo
      ? { tipo: row.entidade_tipo, id: String(row.entidade_id), descricao: row.entidade_descricao }
      : undefined,
    ip: row.ip || undefined,
    dataHora: row.data_hora,
    dadosAnteriores: row.dados_anteriores ? (typeof row.dados_anteriores === "string" ? JSON.parse(row.dados_anteriores as string) : row.dados_anteriores) : undefined,
    dadosNovos: row.dados_novos ? (typeof row.dados_novos === "string" ? JSON.parse(row.dados_novos as string) : row.dados_novos) : undefined,
  }))

  return NextResponse.json({
    data: logs,
    meta: {
      total: totalItems,
      page,
      limit,
      totalPages: Math.ceil(totalItems / limit),
    }
  })
})

// POST /api/logs - Create manual log entry (e.g. from frontend actions)
export const POST = withRole(["administrador"], async (request, { user }) => {
  try {
    const body = await request.json()
    const { acao, descricao, detalhes, entidade } = body

    if (!acao || !descricao) {
      return NextResponse.json({ error: "Acao e descricao sao obrigatorios" }, { status: 400 })
    }

    await registrarLog({
      acao,
      descricao,
      detalhes,
      usuarioId: user.id,
      usuarioNome: user.nome,
      usuarioRole: user.role,
      entidadeTipo: entidade?.tipo,
      entidadeId: entidade?.id,
      entidadeDescricao: entidade?.descricao,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao registrar log:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
})
