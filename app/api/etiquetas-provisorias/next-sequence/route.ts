import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { ensureEtiquetasSchema } from "@/lib/etiquetas-schema"
import { getEtiquetaSequenceInfo } from "@/lib/etiquetas-sequence"

export const GET = withAuth(async (request) => {
  const url = new URL(request.url)
  const ano = url.searchParams.get("ano") || new Date().getFullYear().toString()

  try {
    await ensureEtiquetasSchema()
    const info = await getEtiquetaSequenceInfo(ano)

    return NextResponse.json({
      nextSeq: info.nextSeq,
      formatted: info.formatted,
      source: info.source,
      manualSetting: info.manualSetting,
    })
  } catch (error) {
    console.error("Erro ao obter proxima sequencia:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
})
