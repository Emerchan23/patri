import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db"
import { verifyAuth } from "@/lib/api-auth"
import { appendScopeClause, getAssetScopeClause, getTransferScopeClause } from "@/lib/asset-scope"

export async function GET(req: NextRequest) {
  const user = await verifyAuth(req)
  if (!user) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
  const assetScoped = appendScopeClause("WHERE 1=1", [], getAssetScopeClause(user, {
    secretariaColumn: "localizacao_secretaria",
    departamentoColumn: "localizacao_departamento",
  }))
  const movementScoped = appendScopeClause("WHERE 1=1", [], getTransferScopeClause(user, {
    fromSecretariaColumn: "de_secretaria",
    fromDepartamentoColumn: "de_departamento",
    toSecretariaColumn: "para_secretaria",
    toDepartamentoColumn: "para_departamento",
  }))
  const loanScoped = appendScopeClause("WHERE 1=1", [], getTransferScopeClause(user, {
    fromSecretariaColumn: "origem_secretaria",
    fromDepartamentoColumn: "origem_departamento",
    toSecretariaColumn: "destino_secretaria",
    toDepartamentoColumn: "destino_departamento",
  }))

  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get("tipo") || "geral"

  if (tipo === "geral") {
    const bens: any = await query(`SELECT COUNT(*) as total FROM bens ${assetScoped.whereClause} AND status = 'ativo'`, assetScoped.params)
    const valorTotal: any = await query(`SELECT COALESCE(SUM(valor), 0) as total FROM bens ${assetScoped.whereClause} AND status = 'ativo'`, assetScoped.params)
    const porCategoria: any = await query(
      `SELECT categoria_slug as categoria, COUNT(*) as total, COALESCE(SUM(valor), 0) as valor
         FROM bens ${assetScoped.whereClause} AND status = 'ativo'
        GROUP BY categoria_slug ORDER BY total DESC`,
      assetScoped.params
    )
    const porSecretaria: any = await query(
      `SELECT localizacao_secretaria as secretaria, COUNT(*) as total, COALESCE(SUM(valor), 0) as valor
         FROM bens ${assetScoped.whereClause} AND status = 'ativo'
        GROUP BY localizacao_secretaria ORDER BY total DESC`,
      assetScoped.params
    )
    const porEstado: any = await query(
      `SELECT estado_conservacao as estado, COUNT(*) as total
         FROM bens ${assetScoped.whereClause} AND status = 'ativo'
        GROUP BY estado_conservacao`,
      assetScoped.params
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
      `SELECT * FROM movimentacoes ${movementScoped.whereClause} ORDER BY data DESC LIMIT 500`,
      movementScoped.params
    )
    return NextResponse.json(rows)
  }

  if (tipo === "emprestimos") {
    const rows = await query(`SELECT * FROM emprestimos ${loanScoped.whereClause} ORDER BY data_emprestimo DESC LIMIT 500`, loanScoped.params)
    return NextResponse.json(rows)
  }

  if (tipo === "baixas") {
    const rows = await query(
      `SELECT * FROM bens ${assetScoped.whereClause} AND status = 'baixado' ORDER BY atualizado_em DESC LIMIT 500`,
      assetScoped.params
    )
    return NextResponse.json(rows)
  }

  return NextResponse.json({ error: "Tipo de relatorio invalido" }, { status: 400 })
}
