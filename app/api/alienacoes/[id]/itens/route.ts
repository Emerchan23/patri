import { NextResponse } from "next/server"
import { withTransaction } from "@/lib/db"
import { withPermission } from "@/lib/api-auth"

// POST /api/alienacoes/[id]/itens - Adicionar item
export const POST = withPermission("gerenciarAlienacoes", async (
  request,
  { params }
) => {
  try {
    const { bem_id } = await request.json()
    const alienacaoId = params?.id
    if (!Number.isInteger(Number(bem_id)) || Number(bem_id) <= 0) {
      return NextResponse.json({ error: "ID do bem invalido" }, { status: 400 })
    }

    const result = await withTransaction(async (connection) => {
      const [processRows] = await connection.execute(
        "SELECT status FROM alienacoes WHERE id = ? FOR UPDATE",
        [alienacaoId]
      )
      const process = (processRows as Array<{ status: string }>)[0]
      if (!process || process.status === "concluido" || process.status === "cancelado") return "closed"

      const [assetRows] = await connection.execute(
        "SELECT id, valor, status FROM bens WHERE id = ? FOR UPDATE",
        [bem_id]
      )
      const asset = (assetRows as Array<{ id: number; valor: number | string; status: string }>)[0]
      if (!asset) return "asset_missing"
      if (asset.status !== "ativo") return "asset_unavailable"

      const [existingRows] = await connection.execute(
        "SELECT id FROM alienacao_itens WHERE alienacao_id = ? AND bem_id = ? FOR UPDATE",
        [alienacaoId, bem_id]
      )
      if ((existingRows as unknown[]).length > 0) return "duplicate"

      await connection.execute(
        `INSERT INTO alienacao_itens (alienacao_id, bem_id, valor_aquisicao, valor_contabil, valor_avaliacao, status_item)
         VALUES (?, ?, ?, ?, ?, 'pendente')`,
        [alienacaoId, asset.id, asset.valor, asset.valor, asset.valor]
      )
      await connection.execute(
        `UPDATE alienacoes a
         SET valor_total_avaliacao = (SELECT COALESCE(SUM(valor_avaliacao), 0) FROM alienacao_itens WHERE alienacao_id = a.id),
             valor_total_itens = (SELECT COUNT(*) FROM alienacao_itens WHERE alienacao_id = a.id)
         WHERE id = ?`,
        [alienacaoId]
      )
      return "ok"
    })

    if (result === "closed") return NextResponse.json({ error: "Alienacao nao encontrada ou encerrada" }, { status: 400 })
    if (result === "asset_missing") return NextResponse.json({ error: "Bem nao encontrado" }, { status: 404 })
    if (result === "asset_unavailable") return NextResponse.json({ error: "Somente bens ativos podem ser vinculados" }, { status: 400 })
    if (result === "duplicate") return NextResponse.json({ error: "Bem ja esta na alienacao" }, { status: 400 })

    return NextResponse.json({ message: "Item adicionado com sucesso" })
  } catch (error) {
    console.error("Erro ao adicionar item:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
})

// DELETE /api/alienacoes/[id]/itens - Remover item
export const DELETE = withPermission("gerenciarAlienacoes", async (
  request,
  { params }
) => {
  try {
    const { searchParams } = new URL(request.url)
    const bem_id = searchParams.get("bemId")
    const alienacaoId = params?.id

    if (!bem_id) {
        return NextResponse.json({ error: "ID do bem necessario" }, { status: 400 })
    }

    const result = await withTransaction(async (connection) => {
      const [processRows] = await connection.execute(
        "SELECT status FROM alienacoes WHERE id = ? FOR UPDATE",
        [alienacaoId]
      )
      const process = (processRows as Array<{ status: string }>)[0]
      if (!process) return "not_found"
      if (process.status === "concluido" || process.status === "cancelado") return "closed"

      const [deleteResult] = await connection.execute(
        "DELETE FROM alienacao_itens WHERE alienacao_id = ? AND bem_id = ? AND status_item = 'pendente'",
        [alienacaoId, bem_id]
      )
      if ((deleteResult as { affectedRows: number }).affectedRows === 0) return "item_missing"
      await connection.execute(
        `UPDATE alienacoes a
         SET valor_total_avaliacao = (SELECT COALESCE(SUM(valor_avaliacao), 0) FROM alienacao_itens WHERE alienacao_id = a.id),
             valor_total_itens = (SELECT COUNT(*) FROM alienacao_itens WHERE alienacao_id = a.id)
         WHERE id = ?`,
        [alienacaoId]
      )
      return "ok"
    })

    if (result === "not_found") return NextResponse.json({ error: "Alienacao nao encontrada" }, { status: 404 })
    if (result === "closed") return NextResponse.json({ error: "Alienacao encerrada nao pode ser alterada" }, { status: 400 })
    if (result === "item_missing") return NextResponse.json({ error: "Bem pendente nao encontrado neste processo" }, { status: 404 })

    return NextResponse.json({ message: "Item removido com sucesso" })

  } catch (error) {
    console.error("Erro ao remover item:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
})
