import { NextResponse } from "next/server"
import { queryOne } from "@/lib/db"
import { verifyPassword, generateToken, setAuthCookie, updateLastAccess, attachUserScopes, sessionDaysToSeconds, type DbUser } from "@/lib/auth-utils"
import { registrarLog } from "@/lib/audit"
import { checkRateLimit } from "@/lib/redis-tools"
import { getSystemSettings } from "@/lib/system-settings"

function getClientIp(request: Request) {
  const xff = request.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  const xri = request.headers.get("x-real-ip")
  if (xri) return xri.trim()
  return "unknown"
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, senha, isMobile } = body
    const startedAt = Date.now()
    const sessionChannel = isMobile ? "mobile" : "web"

    if (!email || !senha) {
      return NextResponse.json({ error: "Email e senha sao obrigatorios" }, { status: 400 })
    }

    const ip = getClientIp(request)
    const normalizedEmail = String(email).trim().toLowerCase()
    const normalizedPassword = String(senha)

    const ipLimit = await checkRateLimit({
      key: `rl:login:ip:${ip}`,
      limit: 30,
      windowSeconds: 300,
    })
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
        { status: 429 }
      )
    }

    const emailLimit = await checkRateLimit({
      key: `rl:login:email:${normalizedEmail}`,
      limit: 10,
      windowSeconds: 300,
    })
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
        { status: 429 }
      )
    }

    // Find user by email OR username (nome_usuario) if email is not an email
    // This allows login with simple username like 'admin'
    let user;
    
    if (email.includes('@')) {
        user = await queryOne<DbUser & { acesso_app: number }>(
          "SELECT * FROM usuarios WHERE email = ?",
          [normalizedEmail]
        );
    } else {
        // Try to find by username or name
        // Assuming there might be a username column or just checking email field as username
        // If your schema only has email, you might need to adjust this.
        // Let's assume for a clean install, admin might be in email field as 'admin' or 'admin@admin.com'
        
        // Try exact match on email field (in case 'admin' was stored there)
        user = await queryOne<DbUser & { acesso_app: number }>(
          "SELECT * FROM usuarios WHERE email = ? OR nome = ?",
          [normalizedEmail, String(email).trim()]
        );
    }
    
    if (!user) {
        // Create a user object structure if we want to fallback, but better to query
        // If it's the very first time and table is empty
        const userCount = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM usuarios");
        
        if (userCount && userCount.count === 0 && (email === 'admin' || email === 'admin@sistema.com')) {
             // We can't verify password here because we don't have the hash in DB yet.
             // But we can create the default user IF password is 'admin' or '123456'
             if (normalizedPassword === 'admin' || normalizedPassword === '123456') {
                 // Create default admin
                 const hash = '$2a$10$X7.z.t/s.t/s.t/s.t/s.t/s.t/s.t/s.t/s.t/s.t/s.t/s.t'; // Dummy hash for 'admin' (needs bcrypt gen)
                 // Actually, let's just return error and ask to seed DB properly
                 return NextResponse.json({ 
                     error: "Sistema recém-instalado. Por favor, execute o script de inicialização ou contate o suporte para criar o primeiro administrador." 
                 }, { status: 401 });
             }
        }

      return NextResponse.json({ error: "Usuário ou senha inválidos" }, { status: 401 })
    }

    if (!user.ativo) {
      return NextResponse.json({ error: "Usuario desativado. Contate o administrador." }, { status: 401 })
    }

    // Check mobile access
    if (isMobile && !user.acesso_app) {
      return NextResponse.json({ error: "Este usuario nao tem permissao para acessar o aplicativo." }, { status: 403 })
    }

    // Verify password
    const isValid = await verifyPassword(normalizedPassword, user.senha_hash)
    if (!isValid) {
      console.warn("[auth/login] senha invalida", { email: normalizedEmail, userId: user.id, ip })
      return NextResponse.json({ error: "Email ou senha invalidos" }, { status: 401 })
    }

    let sessionDays = isMobile ? 30 : 3
    try {
      const systemSettings = await getSystemSettings()
      sessionDays = isMobile ? systemSettings.sessionDaysMobile : systemSettings.sessionDaysWeb
    } catch (settingsError) {
      console.error("[auth/login] falha ao carregar configuracao de sessao", {
        email: normalizedEmail,
        userId: user.id,
        ip,
        isMobile: !!isMobile,
        error: settingsError,
      })
    }
    const sessionMaxAgeSeconds = sessionDaysToSeconds(sessionDays)

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      nome: user.nome,
    }, sessionChannel, sessionMaxAgeSeconds)

    // Set cookie
    await setAuthCookie(token, sessionChannel, sessionMaxAgeSeconds)

    try {
      await updateLastAccess(user.id)
    } catch (updateError) {
      console.error("[auth/login] falha ao atualizar ultimo acesso", {
        userId: user.id,
        email: normalizedEmail,
        ip,
        error: updateError,
      })
    }

    let scopedUser: Awaited<ReturnType<typeof attachUserScopes>>
    try {
      scopedUser = await attachUserScopes(user)
    } catch (scopeError) {
      console.error("[auth/login] falha inesperada ao acoplar escopos do usuario", {
        userId: user.id,
        email: normalizedEmail,
        ip,
        error: scopeError,
      })
      scopedUser = user
    }

    // Register audit log
    await registrarLog({
      acao: "login",
      descricao: "Login realizado no sistema",
      usuarioId: user.id,
      usuarioNome: user.nome,
      usuarioRole: user.role,
      ip,
    })

    // Return user data (without password)
    console.info("[auth/login] sucesso", { userId: user.id, role: user.role, isMobile: !!isMobile, elapsedMs: Date.now() - startedAt })
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
          ? {
              secretaria: user.unidade_secretaria,
              departamento: user.unidade_departamento,
              departamentos: scopedUser.departamentosAssistente,
            }
          : undefined,
        secretariasGerenciadas: scopedUser.secretariasGerenciadas,
        departamentosAssistente: scopedUser.departamentosAssistente,
        podeCadastrarBem: scopedUser.pode_cadastrar_bem ?? null,
        podeCadastroProvisorioUnidade: scopedUser.pode_cadastro_provisorio_unidade ?? null,
        permissionOverrides: scopedUser.permissionOverrides,
        permissions: scopedUser.permissions,
        criadoEm: user.criado_em,
        ultimoAcesso: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error("[auth/login] erro interno", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
