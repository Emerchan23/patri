import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { verifyAuth } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req)
  if (!user) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })

  const rows = await query("SELECT * FROM etiquetas_provisorias ORDER BY created_at DESC")
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req)
  if (!user) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })

  const body = await req.json()
  const { codigo, descricao, secretaria, departamento, sala, responsavel, data_etiqueta, observacoes, status: st } = body

  const result: any = await query(
    `INSERT INTO etiquetas_provisorias (codigo, descricao, secretaria, departamento, sala, responsavel, data_etiqueta, observacoes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [codigo, descricao, secretaria || null, departamento || null, sala || null, responsavel || null, data_etiqueta || null, observacoes || null, st || "pendente"]
  )

  await logAudit(user.id, user.nome, "Etiqueta provisoria criada", `Codigo: ${codigo}`)
  const newRow = await query("SELECT * FROM etiquetas_provisorias WHERE id = ?", [result.insertId])
  return NextResponse.json((newRow as any[])[0], { status: 201 })
}
