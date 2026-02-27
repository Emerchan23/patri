import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { verifyAuth } from "@/lib/api-auth"

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req)
  if (!user) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get("tipo") || "geral"

  if (tipo === "geral") {
    const bens: any = await query("SELECT COUNT(*) as total FROM bens WHERE status = 'ativo'")
    const valorTotal: any = await query("SELECT COALESCE(SUM(valor_aquisicao), 0) as total FROM bens WHERE status = 'ativo'")
    const porCategoria: any = await query(
      "SELECT categoria, COUNT(*) as total, COALESCE(SUM(valor_aquisicao), 0) as valor FROM bens WHERE status = 'ativo' GROUP BY categoria ORDER BY total DESC"
    )
    const porSecretaria: any = await query(
      "SELECT secretaria, COUNT(*) as total, COALESCE(SUM(valor_aquisicao), 0) as valor FROM bens WHERE status = 'ativo' GROUP BY secretaria ORDER BY total DESC"
    )
    const porEstado: any = await query(
      "SELECT estado, COUNT(*) as total FROM bens WHERE status = 'ativo' GROUP BY estado"
    )
    return NextResponse.json({
      totalBens: bens[0].total,
      valorTotal: valorTotal[0].total,
      porCategoria,
      porSecretaria,
      porEstado,
    })
  }

  if (tipo === "movimentacoes") {
    const rows = await query(
      "SELECT * FROM movimentacoes ORDER BY data_movimentacao DESC LIMIT 500"
    )
    return NextResponse.json(rows)
  }

  if (tipo === "emprestimos") {
    const rows = await query("SELECT * FROM emprestimos ORDER BY data_emprestimo DESC LIMIT 500")
    return NextResponse.json(rows)
  }

  if (tipo === "baixas") {
    const rows = await query(
      "SELECT * FROM bens WHERE status = 'baixado' ORDER BY updated_at DESC LIMIT 500"
    )
    return NextResponse.json(rows)
  }

  return NextResponse.json({ error: "Tipo de relatorio invalido" }, { status: 400 })
}
