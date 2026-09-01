import { NextRequest, NextResponse } from "next/server"

import { verifyAuth } from "@/lib/api-auth"
import { query } from "@/lib/db"

export async function GET(request: NextRequest) {
  const user = await verifyAuth(request)
  if (!user) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 })
  }

  if (user.role !== "administrador" && user.role !== "gestor") {
    return NextResponse.json({ error: "Sem permissao para acessar diagnostico de duplicados." }, { status: 403 })
  }

  const duplicatePatrimonios = await query(
    `SELECT patrimonio, COUNT(*) as total, GROUP_CONCAT(id ORDER BY id ASC) as bem_ids
       FROM bens
      WHERE patrimonio IS NOT NULL
        AND TRIM(patrimonio) <> ''
      GROUP BY patrimonio
     HAVING COUNT(*) > 1
      ORDER BY total DESC, patrimonio ASC`
  ) as Array<{ patrimonio: string; total: number; bem_ids: string }>

  const duplicateProvisorios = await query(
    `SELECT patrimonio_provisorio as patrimonio_provisorio, COUNT(*) as total, GROUP_CONCAT(id ORDER BY id ASC) as bem_ids
       FROM bens
      WHERE patrimonio_provisorio IS NOT NULL
        AND TRIM(patrimonio_provisorio) <> ''
      GROUP BY patrimonio_provisorio
     HAVING COUNT(*) > 1
      ORDER BY total DESC, patrimonio_provisorio ASC`
  ) as Array<{ patrimonio_provisorio: string; total: number; bem_ids: string }>

  const patrimonioIndex = await query(
    `SHOW INDEX FROM bens WHERE Key_name = 'patrimonio' OR Key_name = 'idx_bens_patrimonio'`
  ) as Array<{ Key_name: string; Non_unique: number; Column_name: string }>

  const hasUniquePatrimonioIndex = patrimonioIndex.some(
    (index) => index.Column_name === "patrimonio" && Number(index.Non_unique) === 0
  )

  return NextResponse.json({
    duplicates: {
      patrimonio: duplicatePatrimonios.map((row) => ({
        codigo: row.patrimonio,
        total: Number(row.total || 0),
        bemIds: String(row.bem_ids || "")
          .split(",")
          .map((value) => Number(value))
          .filter((value) => !Number.isNaN(value)),
      })),
      patrimonioProvisorio: duplicateProvisorios.map((row) => ({
        codigo: row.patrimonio_provisorio,
        total: Number(row.total || 0),
        bemIds: String(row.bem_ids || "")
          .split(",")
          .map((value) => Number(value))
          .filter((value) => !Number.isNaN(value)),
      })),
    },
    integrity: {
      hasUniquePatrimonioIndex,
      indexes: patrimonioIndex,
    },
  })
}
