import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"

// GET /api/bens/validar-etiqueta?codigo=PROV-2025-00042
export const GET = withAuth(async (request, { user }) => {
  const url = new URL(request.url)
  const codigo = url.searchParams.get("codigo")

  if (!codigo) {
    return NextResponse.json({ error: "Codigo obrigatorio" }, { status: 400 })
  }

  try {
    // 1. Check if tag exists in 'etiquetas_provisorias'
    const tagResult = await query(
      `SELECT * FROM etiquetas_provisorias WHERE codigo = ?`,
      [codigo]
    ) as any[]

    const tag = tagResult[0]

    // 2. Check if already used in 'bens' (redundant check if logic is correct, but safe)
    const bemResult = await query(
      `SELECT id, descricao, patrimonio FROM bens WHERE patrimonio_provisorio = ? OR patrimonio = ?`,
      [codigo, codigo]
    ) as any[]

    const bem = bemResult[0]

    if (bem) {
      return NextResponse.json({
        valid: false,
        message: "Esta etiqueta ja esta vinculada a um bem.",
        bem: {
            id: bem.id,
            descricao: bem.descricao,
            patrimonio: bem.patrimonio
        }
      })
    }

    if (!tag) {
      // If tag doesn't exist in our table, it might be a manual tag or legacy.
      // We allow it if it follows the format, but warn.
      return NextResponse.json({
        valid: true,
        exists: false,
        message: "Etiqueta nao encontrada no registro de impressoes, mas pode ser utilizada."
      })
    }

    if (tag.status === 'em_uso') {
       return NextResponse.json({
        valid: false,
        message: "Esta etiqueta consta como 'em uso' no sistema.",
      })
    }

    return NextResponse.json({
      valid: true,
      exists: true,
      tag: tag
    })

  } catch (error) {
    console.error("Erro ao validar etiqueta:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
})
