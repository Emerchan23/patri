import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { verifyAuth } from "@/lib/api-auth"
import { logAudit } from "@/lib/audit"

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req)
  if (!user) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })

  const rows = await query("SELECT * FROM notas_fiscais ORDER BY created_at DESC")
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req)
  if (!user) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })

  const body = await req.json()
  const { numero_nota, fornecedor, data_emissao, data_entrada, valor_total, observacoes, itens } = body

  const result: any = await query(
    `INSERT INTO notas_fiscais (numero_nota, fornecedor, data_emissao, data_entrada, valor_total, observacoes, registrado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [numero_nota, fornecedor || null, data_emissao || null, data_entrada || null, valor_total || 0, observacoes || null, user.nome]
  )

  const notaId = result.insertId

  if (itens && Array.isArray(itens)) {
    for (const item of itens) {
      await query(
        `INSERT INTO nota_fiscal_itens (nota_fiscal_id, descricao, quantidade, valor_unitario, valor_total, categoria)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [notaId, item.descricao, item.quantidade || 1, item.valor_unitario || 0, item.valor_total || 0, item.categoria || null]
      )
    }
  }

  await logAudit(user.id, user.nome, "Nota fiscal registrada", `NF: ${numero_nota}`)
  const newNota = await query("SELECT * FROM notas_fiscais WHERE id = ?", [notaId])
  return NextResponse.json((newNota as any[])[0], { status: 201 })
}
