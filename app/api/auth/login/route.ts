import { NextResponse } from "next/server"
import { queryOne, query } from "@/lib/db"
import { verifyPassword, generateToken, setAuthCookie, updateLastAccess, type DbUser } from "@/lib/auth-utils"
import { registrarLog } from "@/lib/audit"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, senha, isMobile } = body

    if (!email || !senha) {
      return NextResponse.json({ error: "Email e senha sao obrigatorios" }, { status: 400 })
    }

    // Find user by email
    const user = await queryOne<DbUser & { acesso_app: number }>(
      "SELECT * FROM usuarios WHERE email = ?",
      [email]
    )

    if (!user) {
      return NextResponse.json({ error: "Email ou senha invalidos" }, { status: 401 })
    }

    if (!user.ativo) {
      return NextResponse.json({ error: "Usuario desativado. Contate o administrador." }, { status: 401 })
    }

    // Check mobile access
    if (isMobile && !user.acesso_app) {
      return NextResponse.json({ error: "Este usuario nao tem permissao para acessar o aplicativo." }, { status: 403 })
    }

    // Verify password
    const isValid = await verifyPassword(senha, user.senha_hash)
    if (!isValid) {
      return NextResponse.json({ error: "Email ou senha invalidos" }, { status: 401 })
    }

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      nome: user.nome,
    })

    // Set cookie
    await setAuthCookie(token)

    // Update last access
    await updateLastAccess(user.id)

    // Get secretarias gerenciadas if gestor
    let secretariasGerenciadas: string[] | undefined
    if (user.role === "gestor") {
      const secs = await query<{ secretaria: string }>(
        "SELECT secretaria FROM secretarias_gerenciadas WHERE usuario_id = ?",
        [user.id]
      )
      secretariasGerenciadas = secs.map((s) => s.secretaria)
    }

    // Register audit log
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown"
    await registrarLog({
      acao: "login",
      descricao: "Login realizado no sistema",
      usuarioId: user.id,
      usuarioNome: user.nome,
      usuarioRole: user.role,
      ip,
    })

    // Return user data (without password)
    return NextResponse.json({
      user: {
        id: String(user.id),
        nome: user.nome,
        email: user.email,
        cargo: user.cargo,
        role: user.role,
        ativo: Boolean(user.ativo),
        avatar: user.avatar,
        unidade: user.unidade_secretaria
          ? { secretaria: user.unidade_secretaria, departamento: user.unidade_departamento }
          : undefined,
        secretariasGerenciadas,
        criadoEm: user.criado_em,
        ultimoAcesso: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
