import { NextResponse } from "next/server"
import { execute, query } from "@/lib/db"
import { registrarLog } from "@/lib/audit"
import { withPermission } from "@/lib/api-auth"
import {
  mobileSupplierSchemaReady,
  normalizeSupplierDocument,
  validateMobileSupplier,
} from "@/lib/mobile-fornecedores"

export const dynamic = "force-dynamic"

export const POST = withPermission("gerenciarCadastrosAuxiliares", async (request, { user }) => {
  let body: Record<string, unknown>
  try {
    const parsed: unknown = await request.json()
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "Informe os dados do fornecedor." }, { status: 400 })
    }
    body = parsed as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Corpo JSON inválido." }, { status: 400 })
  }

  const validation = validateMobileSupplier(body)
  if ("error" in validation) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }
  if (!(await mobileSupplierSchemaReady())) {
    return NextResponse.json(
      { error: "O esquema de fornecedores precisa de uma migração explícita antes do cadastro móvel." },
      { status: 409 },
    )
  }

  const documents = await query<{ id: number; cnpj: string | null }>(
    "SELECT id, cnpj FROM fornecedores WHERE cnpj IS NOT NULL",
  )
  const duplicate = documents.find(
    (row) => normalizeSupplierDocument(row.cnpj) === validation.data.normalizedDocument,
  )
  if (duplicate) {
    return NextResponse.json({ error: "Já existe fornecedor com este CPF/CNPJ." }, { status: 409 })
  }

  try {
    const result = await execute(
      `INSERT INTO fornecedores (nome, cnpj, nome_fantasia, razao_social, estado, cidade, telefone, endereco)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        validation.data.nome,
        validation.data.documento,
        validation.data.nomeFantasia,
        validation.data.razaoSocial,
        validation.data.estado,
        validation.data.cidade,
        validation.data.telefone,
        validation.data.endereco,
      ],
    )
    await registrarLog({
      acao: "cadastro",
      descricao: `Fornecedor criado: ${validation.data.nomeFantasia}`,
      usuarioId: user.id,
      usuarioNome: user.nome,
      usuarioRole: user.role,
      entidadeTipo: "fornecedor",
      entidadeId: String(result.insertId),
      entidadeDescricao: validation.data.nomeFantasia,
    })
    return NextResponse.json({ id: String(result.insertId) }, { status: 201 })
  } catch (error) {
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Já existe fornecedor com este CPF/CNPJ." }, { status: 409 })
    }
    console.error("Erro ao cadastrar fornecedor pelo app:", error)
    return NextResponse.json({ error: "Não foi possível cadastrar o fornecedor." }, { status: 500 })
  }
})
