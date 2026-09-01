import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { ensureCadastrosProvisoriosSchema } from "@/lib/cadastros-provisorios-schema"
import {
  extractCadastroPayload,
  gerarCodigoCadastroProvisorio,
  inserirHistoricoCadastro,
  listCadastrosProvisorios,
  serializeCadastro,
} from "@/lib/cadastros-provisorios"
import { withTransaction } from "@/lib/db"
import { registrarLog } from "@/lib/audit"
import { criarNotificacao } from "@/lib/notifications"

export const GET = withAuth(async (request, { user }) => {
  await ensureCadastrosProvisoriosSchema()

  const { searchParams } = new URL(request.url)
  const filters = {
    status: searchParams.get("status") || "todos",
    secretaria: searchParams.get("secretaria") || "todas",
    departamento: searchParams.get("departamento") || "todos",
    sala: searchParams.get("sala") || "todas",
    search: searchParams.get("search") || "",
  }

  if (user.role === "assistente" && !user.permissions?.acessarCadastrosProvisorios) {
    return NextResponse.json({ error: "Sem permissao para acessar cadastros provisórios." }, { status: 403 })
  }

  const rows = await listCadastrosProvisorios(user, filters)
  return NextResponse.json({
    data: rows.map(serializeCadastro),
  })
})

export const POST = withAuth(async (request, { user }) => {
  await ensureCadastrosProvisoriosSchema()

  if (user.role !== "assistente" || !user.permissions?.acessarCadastrosProvisorios) {
    return NextResponse.json({ error: "Somente assistentes liberados podem criar cadastro provisório." }, { status: 403 })
  }

  if (!user.unidade_secretaria) {
    return NextResponse.json({ error: "Usuário sem unidade vinculada." }, { status: 400 })
  }

  const body = await request.json()
  const payload = extractCadastroPayload(body)

  if (!payload.descricao || !payload.categoria || !payload.secretaria || !payload.departamento || !payload.sala) {
    return NextResponse.json(
      { error: "Descrição, categoria, secretaria, departamento e sala são obrigatórios." },
      { status: 400 }
    )
  }

  const allowedDepartments =
    user.departamentosAssistente?.length
      ? user.departamentosAssistente
      : user.unidade_departamento
        ? [user.unidade_departamento]
        : []

  if (payload.secretaria !== user.unidade_secretaria) {
    return NextResponse.json({ error: "O cadastro provisório deve ficar na secretaria vinculada ao assistente." }, { status: 403 })
  }

  if (allowedDepartments.length > 0 && !allowedDepartments.includes(payload.departamento)) {
    return NextResponse.json({ error: "O departamento informado não faz parte do escopo do assistente." }, { status: 403 })
  }

  const result = await withTransaction(async (connection) => {
    const [insertResult] = await connection.execute<any>(
      `INSERT INTO cadastros_provisorios_unidade
        (status, solicitante_usuario_id, solicitante_nome, origem_secretaria, origem_departamento, origem_sala,
         descricao, categoria_slug, grupo, marca, modelo, fornecedor, numero_serie, quantidade, valor,
         estado_conservacao, responsavel_nome, responsavel_cargo, observacoes, imagem, nota_fiscal_url,
         emenda_parlamentar, tipo_entrada)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "enviado_pela_unidade",
        Number(user.id),
        user.nome,
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
      ]
    )

    const cadastroId = Number(insertResult.insertId)
    const codigo = await gerarCodigoCadastroProvisorio(cadastroId)
    await connection.execute("UPDATE cadastros_provisorios_unidade SET codigo = ? WHERE id = ?", [codigo, cadastroId])

    await inserirHistoricoCadastro(
      cadastroId,
      {
        acao: "cadastro_criado",
        statusNovo: "enviado_pela_unidade",
        usuarioId: Number(user.id),
        usuarioNome: user.nome,
        usuarioRole: user.role,
        dadosNovos: {
          descricao: payload.descricao,
          categoria: payload.categoria,
          localizacao: {
            secretaria: payload.secretaria,
            departamento: payload.departamento,
            sala: payload.sala,
          },
          quantidade: payload.quantidade,
        },
      },
      connection
    )

    return { id: cadastroId, codigo }
  })

  await registrarLog({
    acao: "cadastro_provisorio_criado",
    descricao: `Cadastro provisório criado pela unidade: ${result.codigo}`,
    usuarioId: Number(user.id),
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "cadastro_provisorio",
    entidadeId: String(result.id),
    entidadeDescricao: result.codigo,
  })

  await criarNotificacao({
    roleDestino: "gestor",
    titulo: "Novo cadastro provisório da unidade",
    mensagem: `${user.nome} enviou o cadastro ${result.codigo} para conferência.`,
    tipo: "info",
    link: "/cadastros-provisorios",
  })

  await criarNotificacao({
    roleDestino: "administrador",
    titulo: "Novo cadastro provisório da unidade",
    mensagem: `${user.nome} enviou o cadastro ${result.codigo} para conferência.`,
    tipo: "info",
    link: "/cadastros-provisorios",
  })

  return NextResponse.json({ id: String(result.id), codigo: result.codigo }, { status: 201 })
})
