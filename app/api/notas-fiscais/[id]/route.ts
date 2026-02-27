import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { verifyAuth } from "@/lib/api-auth"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth(req)
  if (!user) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })

  const { id } = await params
  const nota: any = await query("SELECT * FROM notas_fiscais WHERE id = ?", [id])
  if (!nota.length) return NextResponse.json({ error: "Nota nao encontrada" }, { status: 404 })

  const itens = await query("SELECT * FROM nota_fiscal_itens WHERE nota_fiscal_id = ?", [id])
  return NextResponse.json({ ...nota[0], itens })
}
