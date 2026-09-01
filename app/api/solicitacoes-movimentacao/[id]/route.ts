import { NextResponse } from "next/server"
import { execute, query, queryOne, withTransaction } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"
import { criarNotificacao } from "@/lib/notifications"
import { ensureMovimentacaoSolicitacaoSchema } from "@/lib/movimentacao-solicitacao-schema"
import { registrarMovimentacaoInterna } from "@/lib/movimentacao-service"

function canManageRequest(user: any, request: any) {
  if (user.role === "administrador") return true
  if (user.role === "gestor") {
    const managed = (user.secretariasGerenciadas || []).filter(Boolean)
    return managed.includes(request.secretaria_origem) || managed.includes(request.secretaria_destino)
  }
  return false
}

export const PATCH = withAuth(async (request, { user, params }) => {
  await ensureMovimentacaoSolicitacaoSchema()

  const id = params?.id
  if (!id) {
    return NextResponse.json({ error: "Solicitacao nao informada." }, { status: 400 })
  }

  const body = await request.json()
  const action = String(body.action || "").trim()
  const motivoRejeicao = String(body.motivoRejeicao || "").trim()

  const solicitacao = await queryOne<any>(
    `SELECT *
       FROM solicitacoes_movimentacao
      WHERE id = ?`,
    [id]
  )

  if (!solicitacao) {
    return NextResponse.json({ error: "Solicitacao nao encontrada." }, { status: 404 })
  }

  if (action === "cancelar") {
    if (user.role !== "assistente" || Number(solicitacao.solicitante_usuario_id) !== Number(user.id)) {
      return NextResponse.json({ error: "Voce nao pode cancelar esta solicitacao." }, { status: 403 })
    }
    if (solicitacao.status !== "pendente") {
      return NextResponse.json({ error: "Apenas solicitacoes pendentes podem ser canceladas." }, { status: 409 })
    }

    await execute(
      `UPDATE solicitacoes_movimentacao
          SET status = 'cancelada',
              cancelado_por_usuario_id = ?,
              cancelado_por_nome = ?,
              cancelado_em = NOW()
        WHERE id = ?`,
      [user.id, user.nome, id]
    )

    await registrarLog({
      acao: "cancelamento_solicitacao_movimentacao",
      descricao: "Solicitacao de mudanca cancelada pelo solicitante",
      usuarioId: user.id,
      usuarioNome: user.nome,
      usuarioRole: user.role,
      entidadeTipo: "solicitacao_movimentacao",
      entidadeId: String(id),
      entidadeDescricao: `Solicitacao ${id}`,
    })

    return NextResponse.json({ success: true })
  }

  if (!canManageRequest(user, solicitacao) || !["administrador", "gestor"].includes(String(user.role))) {
    return NextResponse.json({ error: "Sem permissao para decidir esta solicitacao." }, { status: 403 })
  }

  if (solicitacao.status !== "pendente") {
    return NextResponse.json({ error: "Esta solicitacao ja foi decidida." }, { status: 409 })
  }

  const itens = await query<any>(
    `SELECT *
       FROM solicitacoes_movimentacao_itens
      WHERE solicitacao_id = ?
      ORDER BY id`,
    [id]
  )

  if (itens.length === 0) {
    return NextResponse.json({ error: "Esta solicitacao nao possui itens para processar." }, { status: 409 })
  }

  if (action === "rejeitar") {
    if (!motivoRejeicao) {
      return NextResponse.json({ error: "Informe o motivo da rejeicao." }, { status: 400 })
    }

    await execute(
      `UPDATE solicitacoes_movimentacao
          SET status = 'rejeitada',
              motivo_rejeicao = ?,
              rejeitado_por_usuario_id = ?,
              rejeitado_por_nome = ?,
              decidido_em = NOW()
        WHERE id = ?`,
      [motivoRejeicao, user.id, user.nome, id]
    )

    await criarNotificacao({
      usuarioId: Number(solicitacao.solicitante_usuario_id),
      titulo: "Solicitacao de mudanca rejeitada",
      mensagem: `${user.nome} rejeitou sua solicitacao: ${motivoRejeicao}`,
      tipo: "error",
      link: "movimentacoes",
    })

    await registrarLog({
      acao: "rejeicao_solicitacao_movimentacao",
      descricao: "Solicitacao de mudanca rejeitada",
      detalhes: motivoRejeicao,
      usuarioId: user.id,
      usuarioNome: user.nome,
      usuarioRole: user.role,
      entidadeTipo: "solicitacao_movimentacao",
      entidadeId: String(id),
      entidadeDescricao: `${itens.length} bem(ns)`,
    })

    return NextResponse.json({ success: true })
  }

  if (action !== "aprovar") {
    return NextResponse.json({ error: "Acao invalida." }, { status: 400 })
  }

  const bensAtuais = await query<any>(
    `SELECT id, descricao, patrimonio, localizacao_secretaria, localizacao_departamento, localizacao_sala
       FROM bens
      WHERE id IN (${itens.map(() => "?").join(",")})`,
    itens.map((item: any) => item.bem_id)
  )

  for (const item of itens) {
    const currentAsset = bensAtuais.find((bem) => Number(bem.id) === Number(item.bem_id))
    if (!currentAsset) {
      return NextResponse.json({ error: `O bem ${item.patrimonio} nao foi encontrado para aprovacao.` }, { status: 409 })
    }
    const movedSinceRequest =
      String(currentAsset.localizacao_secretaria || "") !== String(item.de_secretaria || "") ||
      String(currentAsset.localizacao_departamento || "") !== String(item.de_departamento || "") ||
      String(currentAsset.localizacao_sala || "") !== String(item.de_sala || "")

    if (movedSinceRequest) {
      return NextResponse.json(
        {
          error: `O bem ${item.patrimonio} ja mudou de local desde a solicitacao. Revise antes de aprovar.`,
        },
        { status: 409 }
      )
    }
  }

  await withTransaction(async (connection) => {
    for (const item of itens) {
      await registrarMovimentacaoInterna(connection, {
        assetId: item.bem_id,
        assetDescricao: item.bem_descricao,
        patrimonio: item.patrimonio,
        de: {
          secretaria: item.de_secretaria,
          departamento: item.de_departamento,
          sala: item.de_sala,
        },
        para: {
          secretaria: solicitacao.secretaria_destino,
          departamento: solicitacao.departamento_destino,
          sala: solicitacao.sala_destino,
        },
        responsavel: user.nome,
        motivo: `Solicitacao aprovada: ${solicitacao.motivo}`,
      })
    }

    await connection.execute(
      `UPDATE solicitacoes_movimentacao
          SET status = 'aprovada',
              aprovado_por_usuario_id = ?,
              aprovado_por_nome = ?,
              decidido_em = NOW()
        WHERE id = ?`,
      [user.id, user.nome, id]
    )
  })

  await criarNotificacao({
    usuarioId: Number(solicitacao.solicitante_usuario_id),
    titulo: "Solicitacao de mudanca aprovada",
    mensagem: `${user.nome} aprovou sua solicitacao para ${solicitacao.departamento_destino} / ${solicitacao.sala_destino}.`,
    tipo: "success",
    link: "movimentacoes",
  })

  await registrarLog({
    acao: "aprovacao_solicitacao_movimentacao",
    descricao: "Solicitacao de mudanca aprovada e aplicada",
    detalhes: `Destino: ${solicitacao.departamento_destino} / ${solicitacao.sala_destino}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "solicitacao_movimentacao",
    entidadeId: String(id),
    entidadeDescricao: `${itens.length} bem(ns)`,
    dadosNovos: {
      secretariaDestino: solicitacao.secretaria_destino,
      departamentoDestino: solicitacao.departamento_destino,
      salaDestino: solicitacao.sala_destino,
    },
  })

  return NextResponse.json({ success: true })
})
