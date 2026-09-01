import { NextResponse } from "next/server"
import { execute } from "@/lib/db"
import { withRole } from "@/lib/api-auth"

export const dynamic = 'force-dynamic'

export const GET = withRole(["administrador"], async () => {
  try {
    // Insert distinct groups from bens into grupos table, ignoring duplicates
    await execute(`
      INSERT INTO grupos (nome)
      SELECT DISTINCT grupo 
      FROM bens 
      WHERE grupo IS NOT NULL 
      AND grupo != '' 
      AND grupo NOT IN (SELECT nome FROM grupos)
    `)
    
    return NextResponse.json({ success: true, message: "Grupos sincronizados com sucesso" })
  } catch (error: any) {
    return NextResponse.json({ error: "Erro ao sincronizar grupos" }, { status: 500 })
  }
})
