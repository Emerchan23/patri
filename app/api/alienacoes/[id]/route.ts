import { NextResponse } from "next/server"
import { query, queryOne, execute } from "@/lib/db"
import { getAuthUser } from "@/lib/auth-utils"

// GET /api/alienacoes/[id] - Detalhes da alienacao
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

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
}

// PUT /api/alienacoes/[id] - Atualizar alienacao
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const {
      status,
      destinatario_nome,
      destinatario_documento,
      destinatario_endereco,
      observacoes,
      concluir // Flag para indicar finalizacao
    } = body

    // Se a flag concluir for true, executa logica de finalizacao
    if (concluir) {
       // Verificar se status permite conclusao
       const atual = await queryOne<any>("SELECT status FROM alienacoes WHERE id = ?", [id])
       if (atual.status === 'concluido') {
         return NextResponse.json({ error: "Alienacao ja concluida" }, { status: 400 })
       }

       // Atualizar alienacao para concluido
       await execute(
         `UPDATE alienacoes SET 
            status = 'concluido', 
            data_conclusao = CURDATE(),
            destinatario_nome = ?,
            destinatario_documento = ?,
            destinatario_endereco = ?,
            observacoes = ?
          WHERE id = ?`,
         [destinatario_nome, destinatario_documento, destinatario_endereco, observacoes, id]
       )

       // Baixar bens vinculados
       // Primeiro pegar os IDs dos bens
       const itens = await query<any>("SELECT bem_id FROM alienacao_itens WHERE alienacao_id = ?", [id])
       
       for (const item of itens) {
         // Atualizar status do bem para baixado
         await execute(
           `UPDATE bens SET status = 'baixado' WHERE id = ?`,
           [item.bem_id]
         )
         
         // Atualizar status do item na alienacao
         await execute(
            `UPDATE alienacao_itens SET status_item = 'alienado' WHERE alienacao_id = ? AND bem_id = ?`,
            [id, item.bem_id]
         )

         // Criar log de auditoria (simplificado, idealmente via API de logs)
         await execute(
           `INSERT INTO audit_logs (acao, descricao, detalhes, usuario_id, usuario_nome, usuario_role, entidade_tipo, entidade_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
           [
             'baixa_alienacao', 
             `Bem baixado por alienacao #${id}`, 
             `Processo concluido`, 
             user.id, 
             user.nome, 
             user.role, 
             'bem', 
             item.bem_id
           ]
         )
       }

       return NextResponse.json({ message: "Alienacao concluida e bens baixados com sucesso" })
    }

    // Atualizacao normal
    await execute(
      `UPDATE alienacoes SET 
        status = COALESCE(?, status),
        destinatario_nome = COALESCE(?, destinatario_nome),
        destinatario_documento = COALESCE(?, destinatario_documento),
        destinatario_endereco = COALESCE(?, destinatario_endereco),
        observacoes = COALESCE(?, observacoes)
       WHERE id = ?`,
      [status, destinatario_nome, destinatario_documento, destinatario_endereco, observacoes, id]
    )

    return NextResponse.json({ message: "Alienacao atualizada com sucesso" })
  } catch (error) {
    console.error("Erro ao atualizar alienacao:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// DELETE /api/alienacoes/[id] - Excluir alienacao (apenas se aberto)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    
    const { id } = await params
    
    // Verificar status
    const alienacao = await queryOne<any>("SELECT status FROM alienacoes WHERE id = ?", [id])
    if (!alienacao) {
        return NextResponse.json({ error: "Alienacao nao encontrada" }, { status: 404 })
    }

    if (alienacao.status !== 'aberto') {
        return NextResponse.json({ error: "Apenas alienacoes em aberto podem ser excluidas" }, { status: 400 })
    }

    await execute("DELETE FROM alienacoes WHERE id = ?", [id])
    
    return NextResponse.json({ message: "Alienacao excluida com sucesso" })

  } catch (error) {
    console.error("Erro ao excluir alienacao:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
