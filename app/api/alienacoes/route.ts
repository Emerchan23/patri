import { NextResponse } from "next/server"
import { query, withTransaction } from "@/lib/db"
import { withPermission } from "@/lib/api-auth"

// GET /api/alienacoes - Listar alienacoes
export const GET = withPermission("gerenciarAlienacoes", async () => {
  try {
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
})

// POST /api/alienacoes - Criar nova alienacao
export const POST = withPermission("gerenciarAlienacoes", async (request, { user }) => {
  try {
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
    if (!["venda", "leilao", "doacao", "permuta", "descarte"].includes(tipo)) {
      return NextResponse.json({ error: "Tipo de alienacao invalido" }, { status: 400 })
    }

    if (!Array.isArray(bens ?? []) || !Array.isArray(comissao ?? [])) {
      return NextResponse.json({ error: "Lista de bens ou comissão inválida" }, { status: 400 })
    }
    const commissionMembers = (comissao ?? []) as Array<{ nome?: unknown; cargo?: unknown; cpf?: unknown; tipo_membro?: unknown }>
    const requestedAssetIds: number[] = (bens ?? []).map((assetId: unknown) => Number(assetId))
    if (requestedAssetIds.length === 0) {
      return NextResponse.json({ error: "Selecione ao menos um bem para a alienacao" }, { status: 400 })
    }
    if (requestedAssetIds.some((assetId) => !Number.isInteger(assetId) || assetId <= 0)) {
      return NextResponse.json({ error: "A lista contém ID de bem inválido" }, { status: 400 })
    }
    if (new Set(requestedAssetIds).size !== requestedAssetIds.length) {
      return NextResponse.json({ error: "A lista contém bens duplicados" }, { status: 400 })
    }
    if (commissionMembers.length < 3 || commissionMembers.some((member) => !String(member?.nome ?? "").trim() || !String(member?.cargo ?? "").trim())) {
      return NextResponse.json({ error: "Informe ao menos três membros com nome e cargo" }, { status: 400 })
    }

    const alienacaoId = await withTransaction(async (connection) => {
      const [result] = await connection.execute(
        `INSERT INTO alienacoes (
          tipo, numero_processo, numero_edital, data_abertura, observacoes, criado_por
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [tipo, numero_processo, numero_edital || null, data_abertura, observacoes || null, user.id]
      )
      const id = (result as { insertId: number }).insertId

      for (const membro of commissionMembers) {
        await connection.execute(
          `INSERT INTO alienacao_comissao (alienacao_id, nome, cargo, cpf, tipo_membro) VALUES (?, ?, ?, ?, ?)`,
          [id, membro.nome, membro.cargo, membro.cpf || null, membro.tipo_membro || "membro"]
        )
      }

      const uniqueAssetIds = requestedAssetIds
      if (uniqueAssetIds.length > 0) {
        const placeholders = uniqueAssetIds.map(() => "?").join(",")
        const [rows] = await connection.execute(
          `SELECT id, valor, status FROM bens WHERE id IN (${placeholders}) FOR UPDATE`,
          uniqueAssetIds
        )
        const assets = rows as Array<{ id: number; valor: number | string | null; status: string }>
        if (assets.length !== uniqueAssetIds.length) {
          throw new Error("Um ou mais bens selecionados não foram encontrados")
        }
        if (assets.some((asset) => asset.status !== "ativo")) {
          throw new Error("Todos os bens selecionados devem estar ativos")
        }

        let totalValue = 0
        for (const asset of assets) {
          const value = Number(asset.valor) || 0
          await connection.execute(
            `INSERT INTO alienacao_itens (alienacao_id, bem_id, valor_aquisicao, valor_contabil, valor_avaliacao, status_item)
             VALUES (?, ?, ?, ?, ?, 'pendente')`,
            [id, asset.id, value, value, value]
          )
          totalValue += value
        }
        await connection.execute(
          `UPDATE alienacoes SET valor_total_avaliacao = ?, valor_total_itens = ? WHERE id = ?`,
          [totalValue, assets.length, id]
        )
      }
      return id
    })

    return NextResponse.json({ id: alienacaoId, message: "Alienacao criada com sucesso" }, { status: 201 })
  } catch (error) {
    console.error("Erro ao criar alienacao:", error)
    if (error instanceof Error && [
      "Um ou mais bens selecionados não foram encontrados",
      "Todos os bens selecionados devem estar ativos",
    ].includes(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
})
