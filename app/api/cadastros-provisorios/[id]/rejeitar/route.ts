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
    return NextResponse.json({ error: "Assistente não pode rejeitar cadastros." }, { status: 403 })
  }

  const cadastro = await getCadastroById(id)
  if (!cadastro) {
    return NextResponse.json({ error: "Cadastro provisório não encontrado." }, { status: 404 })
  }

  if (!userCanAccessCadastro(user, cadastro)) {
    return NextResponse.json({ error: "Sem permissão para rejeitar este cadastro." }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const motivo = typeof body?.motivo === "string" ? body.motivo.trim() : ""

  if (!motivo) {
    return NextResponse.json({ error: "Informe o motivo da rejeição." }, { status: 400 })
  }

  await withTransaction(async (connection) => {
    await connection.execute(
      `UPDATE cadastros_provisorios_unidade
          SET status = 'rejeitado', rejeitado_por_usuario_id = ?, rejeitado_por_nome = ?, rejeitado_em = NOW(),
              motivo_rejeicao = ?
        WHERE id = ?`,
      [Number(user.id), user.nome, motivo, id]
    )

    await inserirHistoricoCadastro(
      id,
      {
        acao: "cadastro_rejeitado",
        statusAnterior: cadastro.status,
        statusNovo: "rejeitado",
        usuarioId: Number(user.id),
        usuarioNome: user.nome,
        usuarioRole: user.role,
        observacao: motivo,
      },
      connection
    )
  })

  await registrarLog({
    acao: "cadastro_provisorio_rejeitado",
    descricao: `Cadastro ${cadastro.codigo} rejeitado`,
    detalhes: motivo,
    usuarioId: Number(user.id),
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "cadastro_provisorio",
    entidadeId: String(id),
    entidadeDescricao: cadastro.codigo || cadastro.descricao,
  })

  await criarNotificacao({
    usuarioId: cadastro.solicitante_usuario_id,
    titulo: "Cadastro rejeitado",
    mensagem: `${cadastro.codigo} foi rejeitado: ${motivo}`,
    tipo: "error",
    link: "/cadastros-provisorios",
  })

  return NextResponse.json({ success: true })
})
