import { NextResponse } from "next/server"
import { query, queryOne, execute } from "@/lib/db"
import { withPermission } from "@/lib/api-auth"

// POST /api/alienacoes/[id]/itens - Adicionar item
export const POST = withPermission("gerenciarAlienacoes", async (
  request,
  { params }
) => {
  try {
    const { bem_id } = await request.json()
    const alienacaoId = params?.id

    // Verificar se alienacao existe e esta aberta
    const alienacao = await queryOne<any>("SELECT status FROM alienacoes WHERE id = ?", [alienacaoId])
    if (!alienacao || alienacao.status === 'concluido') {
      return NextResponse.json({ error: "Alienacao nao encontrada ou ja concluida" }, { status: 400 })
    }

    // Verificar se bem existe
    const bem = await queryOne<any>("SELECT id, valor FROM bens WHERE id = ?", [bem_id])
    if (!bem) {
      return NextResponse.json({ error: "Bem nao encontrado" }, { status: 404 })
    }

    // Verificar se bem ja esta na alienacao
    const existente = await queryOne<any>("SELECT id FROM alienacao_itens WHERE alienacao_id = ? AND bem_id = ?", [alienacaoId, bem_id])
    if (existente) {
      return NextResponse.json({ error: "Bem ja esta na alienacao" }, { status: 400 })
    }

    // Adicionar item
    await execute(
      `INSERT INTO alienacao_itens (alienacao_id, bem_id, valor_aquisicao, valor_contabil, valor_avaliacao, status_item) 
       VALUES (?, ?, ?, ?, ?, 'pendente')`,
      [alienacaoId, bem.id, bem.valor, bem.valor, bem.valor]
    )

    // Atualizar totais da alienacao
    await execute(
      `UPDATE alienacoes a 
       SET valor_total_avaliacao = (SELECT SUM(valor_avaliacao) FROM alienacao_itens WHERE alienacao_id = a.id),
           valor_total_itens = (SELECT COUNT(*) FROM alienacao_itens WHERE alienacao_id = a.id)
       WHERE id = ?`,
      [alienacaoId]
    )

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

    // Remover item
    await execute("DELETE FROM alienacao_itens WHERE alienacao_id = ? AND bem_id = ?", [alienacaoId, bem_id])

    // Atualizar totais
    await execute(
      `UPDATE alienacoes a 
       SET valor_total_avaliacao = (SELECT COALESCE(SUM(valor_avaliacao), 0) FROM alienacao_itens WHERE alienacao_id = a.id),
           valor_total_itens = (SELECT COUNT(*) FROM alienacao_itens WHERE alienacao_id = a.id)
       WHERE id = ?`,
      [alienacaoId]
    )

    return NextResponse.json({ message: "Item removido com sucesso" })

  } catch (error) {
    console.error("Erro ao remover item:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
})
