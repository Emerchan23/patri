import { NextResponse } from "next/server"
import { execute } from "@/lib/db"
import { withRole } from "@/lib/api-auth"

// DELETE: Remove chave
export const DELETE = withRole(["administrador"], async (
  request,
  { params }
) => {
  try {
    await execute("DELETE FROM api_keys WHERE id = ?", [params?.id])
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Erro ao remover chave" }, { status: 500 })
  }
})
