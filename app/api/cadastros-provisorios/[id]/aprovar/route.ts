import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { ensureCadastrosProvisoriosSchema } from "@/lib/cadastros-provisorios-schema"
import {
  criarBemDefinitivadoAPartirDoCadastro,
  getCadastroById,
  inserirHistoricoCadastro,
  userCanAccessCadastro,
} from "@/lib/cadastros-provisorios"
import { withTransaction } from "@/lib/db"
import { registrarLog } from "@/lib/audit"
import { criarNotificacao } from "@/lib/notifications"

export const POST = withAuth(async (_request, { user, params }) => {
  await ensureCadastrosProvisoriosSchema()
  const id = Number(params?.id)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Cadastro inválido." }, { status: 400 })
  }

  if (user.role === "assistente") {
    return NextResponse.json({ error: "Assistente não pode aprovar cadastros." }, { status: 403 })
  }

  const cadastro = await getCadastroById(id)
  if (!cadastro) {
    return NextResponse.json({ error: "Cadastro provisório não encontrado." }, { status: 404 })
  }

  if (!userCanAccessCadastro(user, cadastro)) {
    return NextResponse.json({ error: "Sem permissão para aprovar este cadastro." }, { status: 403 })
  }

  if (cadastro.status === "rejeitado" || cadastro.status === "definitivado") {
    return NextResponse.json({ error: "Este cadastro não pode ser aprovado nesse estágio." }, { status: 400 })
  }

  const result = await withTransaction(async (connection) => {
    const bemDefinitivoId = await criarBemDefinitivadoAPartirDoCadastro(cadastro, connection)

    await connection.execute(
      `UPDATE cadastros_provisorios_unidade
          SET status = 'definitivado', aprovado_por_usuario_id = ?, aprovado_por_nome = ?, aprovado_em = NOW(),
              bem_definitivo_id = ?
        WHERE id = ?`,
      [Number(user.id), user.nome, bemDefinitivoId, id]
    )

    await inserirHistoricoCadastro(
      id,
      {
        acao: "cadastro_aprovado",
        statusAnterior: cadastro.status,
        statusNovo: "definitivado",
        usuarioId: Number(user.id),
        usuarioNome: user.nome,
        usuarioRole: user.role,
        dadosNovos: {
          bemDefinitivoId,
        },
      },
      connection
    )

    return { bemDefinitivoId }
  })

  await registrarLog({
    acao: "cadastro_provisorio_aprovado",
    descricao: `Cadastro ${cadastro.codigo} aprovado e convertido em bem oficial`,
    usuarioId: Number(user.id),
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "cadastro_provisorio",
    entidadeId: String(id),
    entidadeDescricao: cadastro.codigo || cadastro.descricao,
    dadosNovos: {
      bemDefinitivoId: result.bemDefinitivoId,
    },
  })

  await criarNotificacao({
    usuarioId: cadastro.solicitante_usuario_id,
    titulo: "Cadastro aprovado",
    mensagem: `${cadastro.codigo} foi aprovado e entrou no patrimônio oficial.`,
    tipo: "success",
    link: "/cadastros-provisorios",
  })

  return NextResponse.json({ success: true, bemDefinitivoId: String(result.bemDefinitivoId) })
})
