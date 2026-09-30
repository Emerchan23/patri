import { NextResponse } from "next/server"
import { execute, query, queryOne } from "@/lib/db"
import { registrarLog } from "@/lib/audit"
import { withPermission } from "@/lib/api-auth"
import {
  mobileSupplierSchemaReady,
  normalizeSupplierDocument,
  validateMobileSupplier,
} from "@/lib/mobile-fornecedores"

export const dynamic = "force-dynamic"

export const PUT = withPermission("gerenciarCadastrosAuxiliares", async (request, { params, user }) => {
  const id = params?.id
  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Identificador de fornecedor inválido." }, { status: 400 })
  }

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
      { error: "O esquema de fornecedores precisa de uma migração explícita antes da edição móvel." },
      { status: 409 },
    )
  }

  const existing = await queryOne<{ id: number; nome: string; nome_fantasia: string | null }>(
    "SELECT id, nome, nome_fantasia FROM fornecedores WHERE id = ?",
    [id],
  )
  if (!existing) {
    return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 })
  }
  const documents = await query<{ id: number; cnpj: string | null }>(
    "SELECT id, cnpj FROM fornecedores WHERE cnpj IS NOT NULL AND id <> ?",
    [id],
  )
  if (documents.some((row) => normalizeSupplierDocument(row.cnpj) === validation.data.normalizedDocument)) {
    return NextResponse.json({ error: "Já existe fornecedor com este CPF/CNPJ." }, { status: 409 })
  }

  try {
    await execute(
      `UPDATE fornecedores
          SET nome = ?, cnpj = ?, nome_fantasia = ?, razao_social = ?, estado = ?, cidade = ?, telefone = ?, endereco = ?
        WHERE id = ?`,
      [
        validation.data.nome,
        validation.data.documento,
        validation.data.nomeFantasia,
        validation.data.razaoSocial,
        validation.data.estado,
        validation.data.cidade,
        validation.data.telefone,
        validation.data.endereco,
        id,
      ],
    )
    await registrarLog({
      acao: "edicao",
      descricao: `Fornecedor atualizado: ${validation.data.nomeFantasia}`,
      usuarioId: user.id,
      usuarioNome: user.nome,
      usuarioRole: user.role,
      entidadeTipo: "fornecedor",
      entidadeId: id,
      entidadeDescricao: validation.data.nomeFantasia,
      dadosAnteriores: { nome: existing.nome, nomeFantasia: existing.nome_fantasia },
      dadosNovos: { nome: validation.data.nome, nomeFantasia: validation.data.nomeFantasia },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as { code?: string }).code === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Já existe fornecedor com este CPF/CNPJ." }, { status: 409 })
    }
    console.error("Erro ao atualizar fornecedor pelo app:", error)
    return NextResponse.json({ error: "Não foi possível atualizar o fornecedor." }, { status: 500 })
  }
})

export const DELETE = withPermission("gerenciarCadastrosAuxiliares", async (_request, { params, user }) => {
  const id = params?.id
  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Identificador de fornecedor inválido." }, { status: 400 })
  }
  if (!(await mobileSupplierSchemaReady())) {
    return NextResponse.json(
      { error: "O esquema de fornecedores precisa de uma migração explícita antes da exclusão móvel." },
      { status: 409 },
    )
  }
  const existing = await queryOne<{
    id: number
    nome: string
    nome_fantasia: string | null
  }>("SELECT id, nome, nome_fantasia FROM fornecedores WHERE id = ?", [id])
  if (!existing) {
    return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 })
  }

  const names = [...new Set([existing.nome, existing.nome_fantasia].filter(Boolean))] as string[]
  const usage = names.length
    ? await queryOne<{ count: number | string }>(
        `SELECT COUNT(*) AS count FROM bens WHERE fornecedor IN (${names.map(() => "?").join(",")})`,
        names,
      )
    : null
  if (Number(usage?.count ?? 0) > 0) {
    return NextResponse.json(
      { error: "Não é possível excluir: este fornecedor está vinculado a bens." },
      { status: 409 },
    )
  }

  await execute("DELETE FROM fornecedores WHERE id = ?", [id])
  await registrarLog({
    acao: "exclusao",
    descricao: `Fornecedor excluído: ${existing.nome_fantasia || existing.nome}`,
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "fornecedor",
    entidadeId: id,
    entidadeDescricao: existing.nome_fantasia || existing.nome,
  })
  return NextResponse.json({ success: true })
})
