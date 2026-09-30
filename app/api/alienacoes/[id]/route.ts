import { NextResponse } from "next/server"
import { query, queryOne, withTransaction } from "@/lib/db"
import { withPermission } from "@/lib/api-auth"

// GET /api/alienacoes/[id] - Detalhes da alienacao
export const GET = withPermission("gerenciarAlienacoes", async (
  request,
  { params }
) => {
  try {
    const id = params?.id

    // Buscar dados principais
    const alienacao = await queryOne<any>(
      `SELECT a.*, u.nome as criado_por_nome 
       FROM alienacoes a 
       LEFT JOIN usuarios u ON a.criado_por = u.id 
       WHERE a.id = ?`,
      [id]
    )

    if (!alienacao) {
      return NextResponse.json({ error: "Alienacao nao encontrada" }, { status: 404 })
    }

    // Buscar itens
    const itens = await query<any>(
      `SELECT ai.*, b.patrimonio, b.descricao, b.categoria_slug 
       FROM alienacao_itens ai
       JOIN bens b ON ai.bem_id = b.id
       WHERE ai.alienacao_id = ?`,
      [id]
    )

    // Buscar comissao
    const comissao = await query<any>(
      `SELECT * FROM alienacao_comissao WHERE alienacao_id = ?`,
      [id]
    )

    return NextResponse.json({ ...alienacao, itens, comissao })
  } catch (error) {
    console.error("Erro ao buscar alienacao:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
})

// PUT /api/alienacoes/[id] - Atualizar alienacao
export const PUT = withPermission("gerenciarAlienacoes", async (
  request,
  { user, params }
) => {
  try {
    const id = params?.id
    const body = await request.json()
    const {
      status,
      destinatario_nome,
      destinatario_documento,
      destinatario_endereco,
      observacoes,
      tipo,
      numero_processo,
      numero_edital,
      data_abertura,
      concluir // Flag para indicar finalizacao
    } = body

    // Se a flag concluir for true, executa logica de finalizacao
    if (concluir) {
       const result = await withTransaction(async (connection) => {
         const [alienacoes] = await connection.execute(
           "SELECT status FROM alienacoes WHERE id = ? FOR UPDATE",
           [id]
         )
         const atual = (alienacoes as Array<{ status: string }>)[0]
         if (!atual) return "not_found"
         if (atual.status === "concluido") return "already_done"
         if (atual.status === "cancelado") return "cancelled"

         const [rows] = await connection.execute(
           "SELECT bem_id FROM alienacao_itens WHERE alienacao_id = ? AND status_item = 'pendente' FOR UPDATE",
           [id]
         )
         const itens = rows as Array<{ bem_id: number }>
         if (itens.length === 0) return "empty"

         await connection.execute(
           `UPDATE alienacoes SET
              status = 'concluido', data_conclusao = CURDATE(), destinatario_nome = ?,
              destinatario_documento = ?, destinatario_endereco = ?, observacoes = ?
            WHERE id = ?`,
           [destinatario_nome, destinatario_documento, destinatario_endereco, observacoes, id]
         )

         for (const item of itens) {
           await connection.execute("UPDATE bens SET status = 'baixado' WHERE id = ?", [item.bem_id])
           await connection.execute(
             "UPDATE alienacao_itens SET status_item = 'alienado' WHERE alienacao_id = ? AND bem_id = ?",
             [id, item.bem_id]
           )
           await connection.execute(
             `INSERT INTO audit_logs (acao, descricao, detalhes, usuario_id, usuario_nome, usuario_role, entidade_tipo, entidade_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
             ["baixa_alienacao", `Bem baixado por alienacao #${id}`, "Processo concluido", user.id, user.nome, user.role, "bem", item.bem_id]
           )
         }
         return "ok"
       })

       if (result === "not_found") return NextResponse.json({ error: "Alienacao nao encontrada" }, { status: 404 })
       if (result === "already_done") return NextResponse.json({ error: "Alienacao ja concluida" }, { status: 400 })
       if (result === "cancelled") return NextResponse.json({ error: "Alienacao cancelada nao pode ser concluida" }, { status: 400 })
       if (result === "empty") return NextResponse.json({ error: "Inclua ao menos um bem antes de concluir a alienacao" }, { status: 400 })

       return NextResponse.json({ message: "Alienacao concluida e bens baixados com sucesso" })
    }

    if (tipo && !["venda", "leilao", "doacao", "permuta", "descarte"].includes(tipo)) {
      return NextResponse.json({ error: "Tipo de alienacao invalido" }, { status: 400 })
    }
    if (status && !["aberto", "em_avaliacao", "cancelado"].includes(status)) {
      return NextResponse.json({ error: "Status invalido; use o fluxo de conclusao para dar baixa nos bens" }, { status: 400 })
    }
    if (numero_processo !== undefined && !String(numero_processo).trim()) {
      return NextResponse.json({ error: "Numero do processo nao pode ficar vazio" }, { status: 400 })
    }
    const result = await withTransaction(async (connection) => {
      const [rows] = await connection.execute(
        "SELECT status FROM alienacoes WHERE id = ? FOR UPDATE",
        [id]
      )
      const current = (rows as Array<{ status: string }>)[0]
      if (!current) return "not_found"
      if (!["aberto", "em_avaliacao"].includes(current.status)) return "closed"
      await connection.execute(
        `UPDATE alienacoes SET
          tipo = COALESCE(?, tipo),
          numero_processo = COALESCE(?, numero_processo),
          numero_edital = COALESCE(?, numero_edital),
          data_abertura = COALESCE(?, data_abertura),
          status = COALESCE(?, status),
          destinatario_nome = COALESCE(?, destinatario_nome),
          destinatario_documento = COALESCE(?, destinatario_documento),
          destinatario_endereco = COALESCE(?, destinatario_endereco),
          observacoes = COALESCE(?, observacoes)
         WHERE id = ?`,
        [tipo, numero_processo, numero_edital, data_abertura, status, destinatario_nome, destinatario_documento, destinatario_endereco, observacoes, id]
      )
      return "ok"
    })
    if (result === "not_found") return NextResponse.json({ error: "Alienacao nao encontrada" }, { status: 404 })
    if (result === "closed") return NextResponse.json({ error: "Somente processos abertos podem ser editados" }, { status: 400 })

    return NextResponse.json({ message: "Alienacao atualizada com sucesso" })
  } catch (error) {
    console.error("Erro ao atualizar alienacao:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
})

// DELETE /api/alienacoes/[id] - Excluir alienacao (apenas se aberto)
export const DELETE = withPermission("gerenciarAlienacoes", async (
  request,
  { params }
) => {
  try {
    const id = params?.id
    
    const result = await withTransaction(async (connection) => {
      const [rows] = await connection.execute(
        "SELECT status FROM alienacoes WHERE id = ? FOR UPDATE",
        [id]
      )
      const alienacao = (rows as Array<{ status: string }>)[0]
      if (!alienacao) return "not_found"
      if (alienacao.status !== "aberto") return "not_open"
      await connection.execute("DELETE FROM alienacoes WHERE id = ?", [id])
      return "ok"
    })

    if (result === "not_found") return NextResponse.json({ error: "Alienacao nao encontrada" }, { status: 404 })
    if (result === "not_open") return NextResponse.json({ error: "Apenas alienacoes em aberto podem ser excluidas" }, { status: 400 })
    
    return NextResponse.json({ message: "Alienacao excluida com sucesso" })

  } catch (error) {
    console.error("Erro ao excluir alienacao:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
})
