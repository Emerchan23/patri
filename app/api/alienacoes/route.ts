import { NextResponse } from "next/server"
import { query, execute } from "@/lib/db"
import { getAuthUser } from "@/lib/auth-utils"

// GET /api/alienacoes - Listar alienacoes
export async function GET(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const alienacoes = await query(`
      SELECT 
        a.*,
        (SELECT COUNT(*) FROM alienacao_itens WHERE alienacao_id = a.id) as total_itens_count,
        u.nome as criado_por_nome
      FROM alienacoes a
      LEFT JOIN usuarios u ON a.criado_por = u.id
      ORDER BY a.criado_em DESC
    `)

    return NextResponse.json(alienacoes)
  } catch (error) {
    console.error("Erro ao listar alienacoes:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// POST /api/alienacoes - Criar nova alienacao
export async function POST(request: Request) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { 
      tipo, 
      numero_processo, 
      numero_edital, 
      data_abertura, 
      observacoes,
      comissao, // Array de objetos { nome, cargo, cpf, tipo_membro }
      bens // Array de IDs dos bens
    } = body

    if (!tipo || !numero_processo || !data_abertura) {
      return NextResponse.json({ error: "Campos obrigatorios faltando" }, { status: 400 })
    }

    // 1. Criar Alienacao
    const result = await execute(
      `INSERT INTO alienacoes (
        tipo, numero_processo, numero_edital, data_abertura, observacoes, criado_por
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [tipo, numero_processo, numero_edital || null, data_abertura, observacoes || null, user.id]
    )
    
    const alienacaoId = result.insertId

    // 2. Adicionar Membros da Comissao (se houver)
    if (comissao && Array.isArray(comissao) && comissao.length > 0) {
      for (const membro of comissao) {
        await execute(
          `INSERT INTO alienacao_comissao (alienacao_id, nome, cargo, cpf, tipo_membro) VALUES (?, ?, ?, ?, ?)`,
          [alienacaoId, membro.nome, membro.cargo, membro.cpf || null, membro.tipo_membro || 'membro']
        )
      }
    }

    // 3. Adicionar Bens (se houver)
    if (bens && Array.isArray(bens) && bens.length > 0) {
      // Buscar dados atuais dos bens para snapshot
      const bensPlaceholders = bens.map(() => '?').join(',')
      const bensDados = await query<any>(
        `SELECT id, valor, valor as valor_contabil FROM bens WHERE id IN (${bensPlaceholders})`,
        bens
      )

      let totalValorAvaliacao = 0

      for (const bem of bensDados) {
        await execute(
          `INSERT INTO alienacao_itens (alienacao_id, bem_id, valor_aquisicao, valor_contabil, valor_avaliacao, status_item) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [alienacaoId, bem.id, bem.valor, bem.valor, bem.valor, 'pendente']
        )
        totalValorAvaliacao += Number(bem.valor)
      }

      // Atualizar valor total da alienacao
      await execute(
        `UPDATE alienacoes SET valor_total_avaliacao = ?, valor_total_itens = ? WHERE id = ?`,
        [totalValorAvaliacao, bens.length, alienacaoId]
      )
    }

    return NextResponse.json({ id: alienacaoId, message: "Alienacao criada com sucesso" }, { status: 201 })
  } catch (error) {
    console.error("Erro ao criar alienacao:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
