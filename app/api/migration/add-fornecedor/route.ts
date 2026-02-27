import { NextResponse } from "next/server"
import { execute } from "@/lib/db"

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Check if column exists or just try to add it (ignore error if exists)
    try {
        await execute("ALTER TABLE bens ADD COLUMN fornecedor VARCHAR(255) NULL AFTER marca")
        return NextResponse.json({ success: true, message: "Coluna fornecedor adicionada com sucesso" })
    } catch (e: any) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            return NextResponse.json({ success: true, message: "Coluna fornecedor ja existe" })
        }
        throw e
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
