import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { ensureCadastrosProvisoriosSchema } from "@/lib/cadastros-provisorios-schema"
import { getCadastroById, inserirHistoricoCadastro, userCanAccessCadastro } from "@/lib/cadastros-provisorios"
import { withTransaction } from "@/lib/db"
import { registrarLog } from "@/lib/audit"
import { criarNotificacao } from "@/lib/notifications"

export const POST = withAuth(async (request, { user, params }) => {
  await ensureCadastrosProvisoriosSchema()
  const id = Number(params?.id)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Cadastro inválido." }, { status: 400 })
  }

  if (user.role === "assistente") {
    return NextResponse.json({ error: "Assistente não pode encaminhar cadastro para análise final." }, { status: 403 })
  }

  const cadastro = await getCadastroById(id)
  if (!cadastro) {
    return NextResponse.json({ error: "Cadastro provisório não encontrado." }, { status: 404 })
  }

  if (!userCanAccessCadastro(user, cadastro)) {
    return NextResponse.json({ error: "Sem permissão para encaminhar este cadastro." }, { status: 403 })
  }

  if (cadastro.status === "rejeitado" || cadastro.status === "definitivado") {
    return NextResponse.json({ error: "Este cadastro não pode mais ser encaminhado." }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const observacao = typeof body?.observacao === "string" ? body.observacao.trim() : ""

  await withTransaction(async (connection) => {
    await connection.execute(
      `UPDATE cadastros_provisorios_unidade
          SET status = 'em_analise_patrimonio', encaminhado_patrimonio_em = NOW(),
              ajustado_por_usuario_id = ?, ajustado_por_nome = ?, ajustado_em = NOW()
        WHERE id = ?`,
      [Number(user.id), user.nome, id]
    )

    await inserirHistoricoCadastro(
      id,
      {
        acao: "encaminhado_para_patrimonio",
        statusAnterior: cadastro.status,
        statusNovo: "em_analise_patrimonio",
        usuarioId: Number(user.id),
        usuarioNome: user.nome,
        usuarioRole: user.role,
        observacao,
      },
      connection
    )
  })

  await registrarLog({
    acao: "cadastro_provisorio_encaminhado",
    descricao: `Cadastro ${cadastro.codigo} encaminhado para análise do patrimônio`,
    usuarioId: Number(user.id),
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "cadastro_provisorio",
    entidadeId: String(id),
    entidadeDescricao: cadastro.codigo || cadastro.descricao,
  })

  await criarNotificacao({
    roleDestino: "administrador",
    titulo: "Cadastro pronto para aprovação",
    mensagem: `${cadastro.codigo} foi encaminhado para análise final do patrimônio.`,
    tipo: "info",
    link: "/cadastros-provisorios",
  })

  return NextResponse.json({ success: true })
})
