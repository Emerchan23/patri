
import { NextResponse } from "next/server"
import { execute, queryOne } from "@/lib/db"
import { withPermission } from "@/lib/api-auth"

export const DELETE = withPermission("gerenciarCadastrosAuxiliares", async (
  request,
  { params }
) => {
  try {
    const id = params?.id

    // Verificar se existe
    const servidor = await queryOne("SELECT id FROM servidores WHERE id = ?", [id])
    if (!servidor) {
      return NextResponse.json(
        { error: "Servidor não encontrado" },
        { status: 404 }
      )
    }

    await execute("DELETE FROM servidores WHERE id = ?", [id])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao excluir servidor:", error)
    return NextResponse.json(
      { error: "Erro ao excluir servidor" },
      { status: 500 }
    )
  }
})
