import { NextResponse } from "next/server"
import { execute } from "@/lib/db"

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Create table fornecedores
    await execute(`
      CREATE TABLE IF NOT EXISTS fornecedores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(255) NOT NULL UNIQUE,
        cnpj VARCHAR(20),
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    
    // Add column to bens if not exists (redundant but safe)
    try {
        await execute("ALTER TABLE bens ADD COLUMN fornecedor VARCHAR(255) NULL AFTER marca")
    } catch (e: any) {
        // Ignore if exists
    }

    return NextResponse.json({ success: true, message: "Tabela fornecedores criada com sucesso" })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
