import { NextResponse } from "next/server"
import { execute } from "@/lib/db"
import { withRole } from "@/lib/api-auth"

export const dynamic = 'force-dynamic'

export const GET = withRole(["administrador"], async () => {
  try {
    try {
        await execute("ALTER TABLE bens ADD COLUMN nota_fiscal_url VARCHAR(255) NULL AFTER fornecedor")
        return NextResponse.json({ success: true, message: "Coluna nota_fiscal_url adicionada com sucesso" })
    } catch (e: any) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            return NextResponse.json({ success: true, message: "Coluna nota_fiscal_url ja existe" })
        }
        throw e
    }
  } catch (error: any) {
    return NextResponse.json({ error: "Erro ao aplicar migracao" }, { status: 500 })
  }
})
