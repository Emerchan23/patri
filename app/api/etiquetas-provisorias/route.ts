import { NextResponse } from "next/server"
import { query, execute } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"

// POST /api/etiquetas-provisorias - Generate and save provisional tags
export const POST = withAuth(async (request, { user }) => {
  const body = await request.json()
  const { quantidade, ano } = body

  if (!quantidade || quantidade < 1) {
    return NextResponse.json({ error: "Quantidade inválida" }, { status: 400 })
  }

  const currentYear = ano || new Date().getFullYear().toString()
  const generatedTags: string[] = []

  try {
    // Determine next sequence
    // First, check 'bens' table
    const maxBemResult = await query(
        `SELECT patrimonio_provisorio FROM bens 
         WHERE patrimonio_provisorio LIKE ? 
         ORDER BY LENGTH(patrimonio_provisorio) DESC, patrimonio_provisorio DESC 
         LIMIT 1`,
        [`PROV-${currentYear}-%`]
    ) as { patrimonio_provisorio: string }[]

    // Second, check 'etiquetas_provisorias' table
    const maxTagResult = await query(
        `SELECT codigo FROM etiquetas_provisorias 
         WHERE codigo LIKE ? 
         ORDER BY LENGTH(codigo) DESC, codigo DESC 
         LIMIT 1`,
        [`PROV-${currentYear}-%`]
    ) as { codigo: string }[]

    let maxSeq = 0

    // Check max from bens
    if (maxBemResult.length > 0) {
        const parts = maxBemResult[0].patrimonio_provisorio.split("-")
        if (parts.length >= 3) {
            const seq = parseInt(parts[parts.length - 1], 10)
            if (!isNaN(seq)) maxSeq = Math.max(maxSeq, seq)
        }
    }

    // Check max from tags
    if (maxTagResult.length > 0) {
        const parts = maxTagResult[0].codigo.split("-")
        if (parts.length >= 3) {
            const seq = parseInt(parts[parts.length - 1], 10)
            if (!isNaN(seq)) maxSeq = Math.max(maxSeq, seq)
        }
    }

    let nextSeq = maxSeq + 1

    // Generate and insert tags
    for (let i = 0; i < quantidade; i++) {
        const codigo = `PROV-${currentYear}-${String(nextSeq).padStart(5, "0")}`
        
        await execute(
            `INSERT INTO etiquetas_provisorias (codigo, status) VALUES (?, 'disponivel')`,
            [codigo]
        )
        
        generatedTags.push(codigo)
        nextSeq++
    }

    return NextResponse.json({ 
        success: true, 
        tags: generatedTags,
        count: generatedTags.length 
    }, { status: 201 })

  } catch (error) {
    console.error("Erro ao gerar etiquetas:", error)
    return NextResponse.json({ error: "Erro ao gerar etiquetas" }, { status: 500 })
  }
})
