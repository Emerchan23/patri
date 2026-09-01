import { NextResponse } from "next/server"
import { query, queryOne, withTransaction } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"
import { criarNotificacao } from "@/lib/notifications"
import { ensureMovimentacaoSolicitacaoSchema } from "@/lib/movimentacao-solicitacao-schema"
import { appendScopeClause, getAssetScopeClause } from "@/lib/asset-scope"

function getRequestScope(user: { role: string; id: number; unidade_secretaria?: string | null; secretariasGerenciadas?: string[] }) {
  if (user.role === "administrador") {
    return { clause: "", params: [] as unknown[] }
  }

  if (user.role === "gestor") {
    const managed = (user.secretariasGerenciadas || []).filter(Boolean)
    if (managed.length === 0) return { clause: "1=0", params: [] as unknown[] }
    const placeholders = managed.map(() => "?").join(", ")
    return {
      clause: `(sm.secretaria_origem IN (${placeholders}) OR sm.secretaria_destino IN (${placeholders}))`,
      params: [...managed, ...managed],
    }
  }

  return {
    clause: "sm.solicitante_usuario_id = ?",
    params: [user.id],
  }
}

async function validateDestination(secretaria: string, departamento: string, sala: string) {
  const row = await queryOne<{ secretaria_nome: string; departamento_nome: string; sala_nome: string }>(
    `SELECT sec.nome as secretaria_nome, d.nome as departamento_nome, s.nome as sala_nome
       FROM salas s
       JOIN departamentos d ON d.id = s.departamento_id
       JOIN secretarias sec ON sec.id = d.secretaria_id
      WHERE sec.nome = ? AND d.nome = ? AND s.nome = ?`,
    [secretaria, departamento, sala]
  )
  return !!row
}

export const GET = withAuth(async (request, { user }) => {
  await ensureMovimentacaoSolicitacaoSchema()

  const url = new URL(request.url)
  const status = url.searchParams.get("status")
  const secretaria = url.searchParams.get("secretaria")
  const solicitante = url.searchParams.get("solicitante")
  const page = Number(url.searchParams.get("page") || "1")
  const limit = Number(url.searchParams.get("limit") || "20")
  const offset = (page - 1) * limit

  const scope = getRequestScope(user)
  const scoped = appendScopeClause("WHERE 1=1", [], scope)
  let whereClause = scoped.whereClause
  const params: unknown[] = [...scoped.params]

  if (status && status !== "todas") {
    whereClause += " AND sm.status = ?"
    params.push(status)
  }

  if (secretaria && secretaria !== "todas") {
    whereClause += " AND (sm.secretaria_origem = ? OR sm.secretaria_destino = ?)"
    params.push(secretaria, secretaria)
  }

  if (solicitante && solicitante !== "todos") {
    whereClause += " AND sm.solicitante_nome LIKE ?"
    params.push(`%${solicitante}%`)
  }

  const countRows = await query<{ total: number }>(
    `SELECT COUNT(*) as total FROM solicitacoes_movimentacao sm ${whereClause}`,
    params
  )
  const total = Number(countRows[0]?.total || 0)
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const rows = await query<any>(
    `SELECT sm.*,
            COUNT(smi.id) as total_itens
       FROM solicitacoes_movimentacao sm
       LEFT JOIN solicitacoes_movimentacao_itens smi ON smi.solicitacao_id = sm.id
      ${whereClause}
      GROUP BY sm.id
      ORDER BY
        CASE WHEN sm.status = 'pendente' THEN 0 ELSE 1 END,
        sm.criado_em DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  )

  const requestIds = rows.map((row: any) => row.id)
  const items = requestIds.length > 0
    ? await query<any>(
        `SELECT *
           FROM solicitacoes_movimentacao_itens
          WHERE solicitacao_id IN (${requestIds.map(() => "?").join(",")})
          ORDER BY id`,
        requestIds
      )
    : []

  const data = rows.map((row: any) => ({
    id: String(row.id),
    solicitanteId: String(row.solicitante_usuario_id),
    solicitanteNome: row.solicitante_nome,
    solicitanteRole: row.solicitante_role,
    secretariaOrigem: row.secretaria_origem,
    secretariaDestino: row.secretaria_destino,
    departamentoDestino: row.departamento_destino,
    salaDestino: row.sala_destino,
    motivo: row.motivo,
    status: row.status,
    motivoRejeicao: row.motivo_rejeicao || "",
    aprovadoPorNome: row.aprovado_por_nome || null,
    rejeitadoPorNome: row.rejeitado_por_nome || null,
    canceladoPorNome: row.cancelado_por_nome || null,
    criadoEm: row.criado_em,
    decididoEm: row.decidido_em,
    totalItens: Number(row.total_itens || 0),
    itens: items
      .filter((item: any) => Number(item.solicitacao_id) === Number(row.id))
      .map((item: any) => ({
        id: String(item.id),
        bemId: String(item.bem_id),
        patrimonio: item.patrimonio,
        bemDescricao: item.bem_descricao,
        de: {
          secretaria: item.de_secretaria,
          departamento: item.de_departamento,
          sala: item.de_sala,
        },
      })),
  }))

  return NextResponse.json({
    data,
    meta: {
      total,
      page,
      limit,
      totalPages,
    },
  })
})

export const POST = withAuth(async (request, { user }) => {
  await ensureMovimentacaoSolicitacaoSchema()

  if (user.role !== "assistente") {
    return NextResponse.json({ error: "Apenas assistentes podem criar solicitacoes de mudanca." }, { status: 403 })
  }

  const body = await request.json()
  const assetIds = Array.isArray(body.assetIds) ? body.assetIds.map(String).filter(Boolean) : []
  const motivo = String(body.motivo || "").trim()
  const secretariaDestino = String(body.secretariaDestino || "").trim()
  const departamentoDestino = String(body.departamentoDestino || "").trim()
  const salaDestino = String(body.salaDestino || "").trim()

  if (assetIds.length === 0) {
    return NextResponse.json({ error: "Selecione pelo menos um bem para solicitar a mudanca." }, { status: 400 })
  }

  if (!motivo) {
    return NextResponse.json({ error: "Motivo e obrigatorio." }, { status: 400 })
  }

  if (!secretariaDestino || !departamentoDestino || !salaDestino) {
    return NextResponse.json({ error: "Destino da solicitacao incompleto." }, { status: 400 })
  }

  if (!user.unidade_secretaria || secretariaDestino !== user.unidade_secretaria) {
    return NextResponse.json({ error: "O destino precisa estar dentro da mesma secretaria da unidade." }, { status: 403 })
  }

  const destinationExists = await validateDestination(secretariaDestino, departamentoDestino, salaDestino)
  if (!destinationExists) {
    return NextResponse.json({ error: "Destino informado nao existe ou nao pertence a secretaria selecionada." }, { status: 400 })
  }

  const scope = getAssetScopeClause(user)
  const placeholders = assetIds.map(() => "?").join(", ")
  const rows = await query<any>(
    `SELECT id, patrimonio, descricao, localizacao_secretaria, localizacao_departamento, localizacao_sala
       FROM bens
      WHERE id IN (${placeholders})${scope.clause ? ` AND (${scope.clause})` : ""}`,
    [...assetIds, ...scope.params]
  )

  if (rows.length !== assetIds.length) {
    return NextResponse.json({ error: "Um ou mais bens selecionados nao pertencem ao seu escopo atual." }, { status: 403 })
  }

  const secretariasOrigem = Array.from(new Set(rows.map((row: any) => String(row.localizacao_secretaria || ""))))
  if (secretariasOrigem.length !== 1 || secretariasOrigem[0] !== user.unidade_secretaria) {
    return NextResponse.json({ error: "Todos os bens da solicitacao precisam estar na mesma secretaria da unidade do assistente." }, { status: 400 })
  }

  const result = await withTransaction(async (connection) => {
    const [insertRequest] = await connection.execute(
      `INSERT INTO solicitacoes_movimentacao
        (solicitante_usuario_id, solicitante_nome, solicitante_role, secretaria_origem, secretaria_destino, departamento_destino, sala_destino, motivo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.nome,
        user.role,
        user.unidade_secretaria,
        secretariaDestino,
        departamentoDestino,
        salaDestino,
        motivo,
      ]
    )

    const solicitacaoId = Number((insertRequest as any).insertId || 0)

    for (const row of rows) {
      await connection.execute(
        `INSERT INTO solicitacoes_movimentacao_itens
          (solicitacao_id, bem_id, patrimonio, bem_descricao, de_secretaria, de_departamento, de_sala)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          solicitacaoId,
          row.id,
          row.patrimonio,
          row.descricao,
          row.localizacao_secretaria,
          row.localizacao_departamento,
          row.localizacao_sala,
        ]
      )
    }

    return solicitacaoId
  })

  await registrarLog({
    acao: "solicitacao_movimentacao",
    descricao: `Solicitacao de mudanca criada para ${rows.length} bem(ns)`,
    detalhes: `Destino: ${departamentoDestino} / ${salaDestino}. Motivo: ${motivo}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "solicitacao_movimentacao",
    entidadeId: String(result),
    entidadeDescricao: `${rows.length} bem(ns)`,
    dadosNovos: {
      assetIds,
      secretariaDestino,
      departamentoDestino,
      salaDestino,
      motivo,
    },
  })

  await criarNotificacao({
    roleDestino: "gestor",
    titulo: "Nova solicitacao de mudanca",
    mensagem: `${user.nome} solicitou a mudanca de ${rows.length} bem(ns) para ${departamentoDestino}.`,
    tipo: "warning",
    link: "movimentacoes",
  })

  await criarNotificacao({
    roleDestino: "administrador",
    titulo: "Nova solicitacao de mudanca",
    mensagem: `${user.nome} solicitou a mudanca de ${rows.length} bem(ns) para ${departamentoDestino}.`,
    tipo: "warning",
    link: "movimentacoes",
  })

  return NextResponse.json({ id: result }, { status: 201 })
})
