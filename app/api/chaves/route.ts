import { NextResponse } from "next/server"
import { query, execute } from "@/lib/db"
import { getAuthUserFromRequest } from "@/lib/auth-utils"
import crypto from "crypto"

// GET: Lista chaves
export async function GET(request: Request) {
  const session = await getAuthUserFromRequest(request)
  if (!session) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })

  try {
    const keys = await query("SELECT id, nome, chave, ativo, criado_em FROM api_keys ORDER BY criado_em DESC")
    return NextResponse.json(keys)
  } catch (error) {
    return NextResponse.json({ error: "Erro ao buscar chaves" }, { status: 500 })
  }
}

// POST: Cria chave
export async function POST(request: Request) {
  const session = await getAuthUserFromRequest(request)
  if (!session) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })

  try {
    const body = await request.json()
    const { nome } = body
    
    if (!nome) return NextResponse.json({ error: "Nome obrigatorio" }, { status: 400 })

    // Gera chave aleatória segura (prefixo sk_ + 32 chars hex)
    const key = 'sk_' + crypto.randomBytes(16).toString('hex')

    // Ensure table exists
    await execute(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        chave VARCHAR(255) NOT NULL UNIQUE,
        ativo TINYINT DEFAULT 1,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await execute(
      "INSERT INTO api_keys (nome, chave, ativo) VALUES (?, ?, 1)",
      [nome, key]
    )

    return NextResponse.json({ success: true, key })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Erro ao criar chave" }, { status: 500 })
  }
}
