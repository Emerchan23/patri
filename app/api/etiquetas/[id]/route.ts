import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { verifyAuth } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth(req)
  if (!user) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { codigo, descricao, secretaria, departamento, sala, responsavel, data_etiqueta, observacoes, status: st } = body

  await query(
    `UPDATE etiquetas_provisorias SET codigo=?, descricao=?, secretaria=?, departamento=?, sala=?, responsavel=?, data_etiqueta=?, observacoes=?, status=? WHERE id=?`,
    [codigo, descricao, secretaria, departamento, sala, responsavel, data_etiqueta, observacoes, st, id]
  )

  await logAudit(user.id, user.nome, "Etiqueta provisoria atualizada", `ID: ${id}`)
  const updated = await query("SELECT * FROM etiquetas_provisorias WHERE id = ?", [id])
  return NextResponse.json((updated as any[])[0])
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth(req)
  if (!user) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })

  const { id } = await params
  await query("DELETE FROM etiquetas_provisorias WHERE id = ?", [id])
  await logAudit(user.id, user.nome, "Etiqueta provisoria removida", `ID: ${id}`)
  return NextResponse.json({ ok: true })
}
