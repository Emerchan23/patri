import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { ensureCadastrosProvisoriosSchema } from "@/lib/cadastros-provisorios-schema"
import {
  assistantCanEditCadastro,
  extractCadastroPayload,
  getCadastroById,
  inserirHistoricoCadastro,
  managerCanEditCadastro,
  serializeCadastro,
  userCanAccessCadastro,
} from "@/lib/cadastros-provisorios"
import { withTransaction } from "@/lib/db"
import { registrarLog } from "@/lib/audit"

export const GET = withAuth(async (_request, { user, params }) => {
  await ensureCadastrosProvisoriosSchema()
  const id = Number(params?.id)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Cadastro inválido." }, { status: 400 })
  }

  if (user.role === "assistente" && !user.permissions?.acessarCadastrosProvisorios) {
    return NextResponse.json({ error: "Sem permissão para acessar cadastros provisórios." }, { status: 403 })
  }

  const cadastro = await getCadastroById(id)
  if (!cadastro) {
    return NextResponse.json({ error: "Cadastro provisório não encontrado." }, { status: 404 })
  }

  if (!userCanAccessCadastro(user, cadastro)) {
    return NextResponse.json({ error: "Sem permissão para acessar este cadastro." }, { status: 403 })
  }

  return NextResponse.json({ data: serializeCadastro(cadastro) })
})

export const PUT = withAuth(async (request, { user, params }) => {
  await ensureCadastrosProvisoriosSchema()
  const id = Number(params?.id)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Cadastro inválido." }, { status: 400 })
  }

  const existing = await getCadastroById(id)
  if (!existing) {
    return NextResponse.json({ error: "Cadastro provisório não encontrado." }, { status: 404 })
  }

  if (!userCanAccessCadastro(user, existing)) {
    return NextResponse.json({ error: "Sem permissão para editar este cadastro." }, { status: 403 })
  }

  const isAssistant = user.role === "assistente"
  if (isAssistant) {
    if (!user.permissions?.acessarCadastrosProvisorios || !assistantCanEditCadastro(existing.status)) {
      return NextResponse.json({ error: "Este cadastro não pode mais ser alterado pelo assistente." }, { status: 403 })
    }
  } else if (!managerCanEditCadastro(existing.status)) {
    return NextResponse.json({ error: "Este cadastro não pode ser alterado nesse status." }, { status: 400 })
  }

  const body = await request.json()
  const payload = extractCadastroPayload(body)

  if (!payload.descricao || !payload.categoria || !payload.secretaria || !payload.departamento || !payload.sala) {
    return NextResponse.json(
      { error: "Descrição, categoria, secretaria, departamento e sala são obrigatórios." },
      { status: 400 }
    )
  }

  if (isAssistant) {
    const allowedDepartments =
      user.departamentosAssistente?.length
        ? user.departamentosAssistente
        : user.unidade_departamento
          ? [user.unidade_departamento]
          : []

    if (payload.secretaria !== user.unidade_secretaria) {
      return NextResponse.json({ error: "O cadastro provisório deve permanecer na secretaria vinculada ao assistente." }, { status: 403 })
    }

    if (allowedDepartments.length > 0 && !allowedDepartments.includes(payload.departamento)) {
      return NextResponse.json({ error: "O departamento informado não faz parte do escopo do assistente." }, { status: 403 })
    }
  }

  const nextStatus =
    isAssistant && existing.status === "devolvido_para_ajuste"
      ? "enviado_pela_unidade"
      : (!isAssistant && existing.status === "enviado_pela_unidade" ? "em_ajuste_almoxarifado" : existing.status)

  await withTransaction(async (connection) => {
    await connection.execute(
      `UPDATE cadastros_provisorios_unidade
          SET status = ?, origem_secretaria = ?, origem_departamento = ?, origem_sala = ?, descricao = ?, categoria_slug = ?,
              grupo = ?, marca = ?, modelo = ?, fornecedor = ?, numero_serie = ?, quantidade = ?, valor = ?, estado_conservacao = ?,
              responsavel_nome = ?, responsavel_cargo = ?, observacoes = ?, imagem = ?, nota_fiscal_url = ?, emenda_parlamentar = ?,
              tipo_entrada = ?, ajustado_por_usuario_id = ?, ajustado_por_nome = ?, ajustado_em = ?
        WHERE id = ?`,
      [
        nextStatus,
        payload.secretaria,
        payload.departamento,
        payload.sala,
        payload.descricao,
        payload.categoria,
        payload.grupo,
        payload.marca,
        payload.modelo,
        payload.fornecedor,
        payload.numeroSerie,
        payload.quantidade,
        payload.valor,
        payload.estadoConservacao,
        payload.responsavelNome,
        payload.responsavelCargo,
        payload.observacoes,
        payload.imagem,
        payload.notaFiscal,
        payload.emendaParlamentar,
        payload.tipoEntrada,
        isAssistant ? existing.ajustado_por_usuario_id : Number(user.id),
        isAssistant ? existing.ajustado_por_nome : user.nome,
        isAssistant ? existing.ajustado_em : new Date(),
        id,
      ]
    )

    await inserirHistoricoCadastro(
      id,
      {
        acao: isAssistant ? "cadastro_atualizado_unidade" : "cadastro_ajustado_almoxarifado",
        statusAnterior: existing.status,
        statusNovo: nextStatus,
        usuarioId: Number(user.id),
        usuarioNome: user.nome,
        usuarioRole: user.role,
        dadosAnteriores: {
          descricao: existing.descricao,
          categoria: existing.categoria_slug,
          localizacao: {
            secretaria: existing.origem_secretaria,
            departamento: existing.origem_departamento,
            sala: existing.origem_sala,
          },
        },
        dadosNovos: {
          descricao: payload.descricao,
          categoria: payload.categoria,
          localizacao: {
            secretaria: payload.secretaria,
            departamento: payload.departamento,
            sala: payload.sala,
          },
        },
      },
      connection
    )
  })

  await registrarLog({
    acao: isAssistant ? "cadastro_provisorio_editado_unidade" : "cadastro_provisorio_ajustado",
    descricao: `${isAssistant ? "Unidade" : "Almoxarifado/Patrimônio"} atualizou o cadastro ${existing.codigo}`,
    usuarioId: Number(user.id),
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "cadastro_provisorio",
    entidadeId: String(id),
    entidadeDescricao: existing.codigo || existing.descricao,
  })

  const updated = await getCadastroById(id)
  return NextResponse.json({ data: updated ? serializeCadastro(updated) : null })
})
