import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"

// GET /api/logs
export const GET = withAuth(async (request) => {
  const url = new URL(request.url)
  const acao = url.searchParams.get("acao")
  const usuario = url.searchParams.get("usuario")
  const busca = url.searchParams.get("busca")
  const dataInicio = url.searchParams.get("dataInicio")
  const dataFim = url.searchParams.get("dataFim")
  const limit = parseInt(url.searchParams.get("limit") || "100")

  let sql = "SELECT * FROM audit_logs WHERE 1=1"
  const params: unknown[] = []

  if (acao) {
    sql += " AND acao = ?"
    params.push(acao)
  }

  if (usuario) {
    sql += " AND usuario_nome LIKE ?"
    params.push(`%${usuario}%`)
  }

  if (busca) {
    sql += " AND (descricao LIKE ? OR detalhes LIKE ? OR entidade_descricao LIKE ?)"
    const term = `%${busca}%`
    params.push(term, term, term)
  }

  if (dataInicio) {
    sql += " AND data_hora >= ?"
    params.push(dataInicio)
  }

  if (dataFim) {
    sql += " AND data_hora <= ?"
    params.push(dataFim + " 23:59:59")
  }

  sql += " ORDER BY data_hora DESC LIMIT ?"
  params.push(limit)

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

  return NextResponse.json(logs)
})

// POST /api/logs - Create manual log entry (e.g. from frontend actions)
export const POST = withAuth(async (request, { user }) => {
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
