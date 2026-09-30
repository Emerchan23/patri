import { NextResponse } from "next/server"
import { query, execute } from "@/lib/db"
import crypto from "crypto"
import { withRole } from "@/lib/api-auth"
import { maskSecret } from "@/lib/route-security"

async function apiKeysSchemaIssue(): Promise<string | null> {
  const tableRows = await query(
    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1",
    ["api_keys"],
  ) as Array<Record<string, unknown>>
  if (!tableRows.length) {
    return "A tabela de chaves de API não foi provisionada. Aplique a migração explicitamente antes de usar integrações."
  }

  const columnRows = await query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
    ["api_keys"],
  ) as Array<Record<string, unknown>>
  const columns = new Set(columnRows.map((column) => String(column.COLUMN_NAME ?? "")))
  if (!["id", "nome", "chave", "ativo", "criado_em"].every((column) => columns.has(column))) {
    return "A estrutura da tabela de chaves de API está incompleta. Corrija-a por uma migração explícita."
  }

  const uniqueKeyIndexes = await query(
    "SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? AND NON_UNIQUE = 0 LIMIT 1",
    ["api_keys", "chave"],
  ) as Array<Record<string, unknown>>
  if (!uniqueKeyIndexes.length) {
    return "A coluna de chave precisa de um índice único provisionado antes de usar integrações."
  }
  return null
}

// GET: Lista chaves
export const GET = withRole(["administrador"], async () => {
  try {
    const schemaIssue = await apiKeysSchemaIssue()
    if (schemaIssue) return NextResponse.json({ error: schemaIssue }, { status: 409 })
    const keys = await query("SELECT id, nome, chave, ativo, criado_em FROM api_keys ORDER BY criado_em DESC")
    return NextResponse.json(
      (keys as Array<Record<string, unknown>>).map((key) => ({
        ...key,
        chave: typeof key.chave === "string" ? maskSecret(key.chave) : undefined,
      }))
    )
  } catch (error) {
    return NextResponse.json({ error: "Erro ao buscar chaves" }, { status: 500 })
  }
})

// POST: Cria chave
export const POST = withRole(["administrador"], async (request) => {
  try {
    const body = await request.json()
    const nome = typeof body?.nome === "string" ? body.nome.trim() : ""
    if (!nome || nome.length > 100) {
      return NextResponse.json({ error: "Informe um nome de até 100 caracteres." }, { status: 400 })
    }

    // Never apply schema changes implicitly in this endpoint.
    const schemaIssue = await apiKeysSchemaIssue()
    if (schemaIssue) return NextResponse.json({ error: schemaIssue }, { status: 409 })

    // Gera chave aleatória segura (prefixo sk_ + 32 chars hex).
    const key = "sk_" + crypto.randomBytes(16).toString("hex")

    await execute(
      "INSERT INTO api_keys (nome, chave, ativo) VALUES (?, ?, 1)",
      [nome, key]
    )

    return NextResponse.json({ success: true, key })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao criar chave" }, { status: 500 })
  }
})
