import { NextResponse } from "next/server"
import { clearAuthCookie, getAuthUserFromRequest } from "@/lib/auth-utils"
import { registrarLog } from "@/lib/audit"

export async function POST(request: Request) {
  try {
    const user = await getAuthUserFromRequest(request)

    if (user) {
      const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
      await registrarLog({
        acao: "logout",
        descricao: "Logout realizado no sistema",
        usuarioId: user.id,
        usuarioNome: user.nome,
        usuarioRole: user.role,
        ip,
      })
    }

    await clearAuthCookie()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Logout error:", error)
    // Still clear the cookie even on error
    await clearAuthCookie()
    return NextResponse.json({ success: true })
  }
}
