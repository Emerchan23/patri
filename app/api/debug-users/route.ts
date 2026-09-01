import { NextResponse } from "next/server"
import { query } from "@/lib/db"
import { withRole } from "@/lib/api-auth"

export const GET = withRole(["administrador"], async () => {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEBUG_ROUTES !== "true") {
    return NextResponse.json({ error: "Nao encontrado" }, { status: 404 })
  }

  try {
    const rows = await query("SELECT id, nome, email, role FROM usuarios")
    return NextResponse.json(rows)
  } catch (error) {
    return NextResponse.json({ error: "Erro ao consultar usuarios de debug" }, { status: 500 })
  }
})
