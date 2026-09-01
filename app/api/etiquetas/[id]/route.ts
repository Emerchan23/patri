import { NextRequest, NextResponse } from "next/server"
import { query, execute } from "@/lib/db"
import { verifyAuth } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"
import { ensureEtiquetasSchema } from "@/lib/etiquetas-schema"

function normalizeStatus(status?: string | null) {
  const allowed = ["reservada", "em_uso", "usada", "cancelada", "disponivel_para_reuso", "disponivel"]
  return allowed.includes(status || "") ? status : undefined
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth(req)
  if (!user) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })

  await ensureEtiquetasSchema()
  const { id } = await params
  const body = await req.json()

  const updates = {
    codigo: body.codigo?.trim(),
    status: normalizeStatus(body.status),
    bemId: body.bem_id ?? body.bemId ?? null,
    loteId: body.lote_id ?? body.loteId ?? null,
    observacao: body.observacao ?? body.observacoes ?? body.descricao ?? null,
    emendaParlamentar: body.emendaParlamentar ?? body.emenda_parlamentar ?? null,
  }

  if (!updates.codigo) {
    return NextResponse.json({ error: "Codigo obrigatorio" }, { status: 400 })
  }

  await execute(
    `UPDATE etiquetas_provisorias
        SET codigo = ?, status = COALESCE(?, status), bem_id = ?, lote_id = ?, observacao = ?, emenda_parlamentar = ?
      WHERE id = ?`,
    [updates.codigo, updates.status || null, updates.bemId, updates.loteId, updates.observacao, updates.emendaParlamentar, id]
  )

  await logAudit(user.id, user.nome, "Etiqueta provisoria atualizada", `ID: ${id}`)
  const updated = await query("SELECT * FROM etiquetas_provisorias WHERE id = ?", [id])
  return NextResponse.json((updated as any[])[0])
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyAuth(req)
  if (!user) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })

  await ensureEtiquetasSchema()
  const { id } = await params
  await execute("DELETE FROM etiquetas_provisorias WHERE id = ?", [id])
  await logAudit(user.id, user.nome, "Etiqueta provisoria removida", `ID: ${id}`)
  return NextResponse.json({ ok: true })
}
