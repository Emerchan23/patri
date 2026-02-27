import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"

// GET /api/etiquetas-provisorias/next-sequence?ano=2025
export const GET = withAuth(async (request, { user }) => {
  const url = new URL(request.url)
  const ano = url.searchParams.get("ano") || new Date().getFullYear().toString()

  try {
    const basePatrimonioPattern = `PROV-${ano}-`
    
    // Check bens
    const rows = await query(
        `SELECT patrimonio_provisorio FROM bens WHERE patrimonio_provisorio LIKE ?`, 
        [`${basePatrimonioPattern}%`]
    ) as { patrimonio_provisorio: string }[];

    // Check tags
    const tagRows = await query(
        `SELECT codigo FROM etiquetas_provisorias WHERE codigo LIKE ?`,
        [`${basePatrimonioPattern}%`]
    ) as { codigo: string }[];

    let maxSeq = 0;
    
    // Check bens
    for (const row of rows) {
        if (!row.patrimonio_provisorio) continue;
        const suffix = row.patrimonio_provisorio.replace(basePatrimonioPattern, "");
        if (/^\d+$/.test(suffix)) {
            const val = parseInt(suffix);
            if (val < 1000000 && val > maxSeq) {
                maxSeq = val;
            }
        }
    }

    // Check tags
    for (const row of tagRows) {
        const suffix = row.codigo.replace(basePatrimonioPattern, "");
        if (/^\d+$/.test(suffix)) {
            const val = parseInt(suffix);
            if (val < 1000000 && val > maxSeq) {
                maxSeq = val;
            }
        }
    }

    const nextSeq = maxSeq + 1

    return NextResponse.json({ 
        nextSeq: nextSeq,
        formatted: `${basePatrimonioPattern}${String(nextSeq).padStart(5, "0")}`
    })

  } catch (error) {
    console.error("Erro ao obter proxima sequencia:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
})
