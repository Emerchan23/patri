import { NextResponse } from "next/server"
import { execute } from "@/lib/db"
import { getAuthUserFromRequest } from "@/lib/auth-utils"

// DELETE: Remove chave
export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params
  const session = await getAuthUserFromRequest(request)
  if (!session) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })

  try {
    await execute("DELETE FROM api_keys WHERE id = ?", [params.id])
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Erro ao remover chave" }, { status: 500 })
  }
}
