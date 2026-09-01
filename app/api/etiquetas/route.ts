import { NextRequest, NextResponse } from "next/server"
import { query, execute } from "@/lib/db"
import { verifyAuth } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"
import { ensureEtiquetasSchema } from "@/lib/etiquetas-schema"

function normalizeStatus(status?: string | null) {
  const allowed = ["reservada", "em_uso", "usada", "cancelada", "disponivel_para_reuso", "disponivel"]
  return allowed.includes(status || "") ? status : "reservada"
}

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req)
  if (!user) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })

  await ensureEtiquetasSchema()
  const rows = await query(
    `SELECT id, codigo, gerado_em, status, bem_id, lote_id, observacao, emenda_parlamentar, reservado_por_usuario_id, reservado_por_nome, cancelado_em, usado_em
       FROM etiquetas_provisorias
      ORDER BY gerado_em DESC, id DESC`
  )
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req)
  if (!user) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })

  await ensureEtiquetasSchema()
  const body = await req.json()
  const codigo = body.codigo?.trim()

  if (!codigo) {
    return NextResponse.json({ error: "Codigo obrigatorio" }, { status: 400 })
  }

  const observacao = body.observacao || body.observacoes || body.descricao || null
  const emenda = body.emendaParlamentar || body.emenda_parlamentar || null
  const status = normalizeStatus(body.status)

  const result: any = await execute(
    `INSERT INTO etiquetas_provisorias
      (codigo, status, bem_id, lote_id, observacao, emenda_parlamentar, reservado_por_usuario_id, reservado_por_nome)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      codigo,
      status,
      body.bem_id || null,
      body.lote_id || null,
      observacao,
      emenda,
      user.id,
      user.nome,
    ]
  )

  await logAudit(user.id, user.nome, "Etiqueta provisoria criada", `Codigo: ${codigo}`)
  const newRow = await query("SELECT * FROM etiquetas_provisorias WHERE id = ?", [result.insertId])
  return NextResponse.json((newRow as any[])[0], { status: 201 })
}
