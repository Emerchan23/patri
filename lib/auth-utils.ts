import bcrypt from "bcryptjs"
import crypto from "crypto"
import jwt from "jsonwebtoken"
import { cookies, headers } from "next/headers"
import { query, queryOne, execute } from "./db"
import { isTokenBlacklisted } from "./redis-tools"
import { ensureUserScopeSchema } from "./user-scope-schema"
import { getPermissions, resolveUserPermissionOverrides, type Permissions } from "./auth"

const DEFAULT_JWT_SECRET = "sispatrimonio-secret-key-2025-change-in-production"
const COOKIE_NAME = "sispatrimonio_token"
const WEB_SESSION_MAX_AGE_SECONDS = 3 * 24 * 60 * 60
const MOBILE_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

/**
 * Cookies marked as Secure are discarded by browsers when the system is
 * accessed through HTTP. AUTH_COOKIE_SECURE always takes precedence; without
 * it, infer the protocol from the request so the same image works on HTTP
 * installations and remains secure behind an HTTPS proxy.
 */
async function shouldUseSecureAuthCookie(): Promise<boolean> {
  const configuredValue = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase()

  if (configuredValue === "true") return true
  if (configuredValue === "false") return false

  const requestHeaders = await headers()
  const forwardedProtocol = [
    requestHeaders.get("x-forwarded-proto"),
    requestHeaders.get("x-forwarded-protocol"),
    requestHeaders.get("x-url-scheme"),
  ]
    .find(Boolean)
    ?.split(",")[0]
    ?.trim()
    .toLowerCase()
  const forwardedSsl = [requestHeaders.get("x-forwarded-ssl"), requestHeaders.get("front-end-https")]
    .find(Boolean)
    ?.trim()
    .toLowerCase()

  return forwardedProtocol === "https" || forwardedSsl === "on"
}

export type AuthSessionChannel = "web" | "mobile"

export interface JwtPayload {
  userId: number
  email: string
  role: string
  nome: string
  jti?: string
  iat?: number
  exp?: number
}

export interface DbUser {
  id: number
  nome: string
  email: string
  senha_hash: string
  cargo: string
  role: "administrador" | "gestor" | "assistente"
  ativo: number
  pode_cadastrar_bem?: number | null
  pode_cadastro_provisorio_unidade?: number | null
  avatar: string
  unidade_secretaria: string | null
  unidade_departamento: string | null
  criado_em: string
  ultimo_acesso: string | null
}

export type ScopedDbUser = DbUser & {
  secretariasGerenciadas?: string[]
  departamentosAssistente?: string[]
  permissionOverrides?: {
    cadastrarBem?: boolean | null
    cadastroProvisorioUnidade?: boolean | null
  }
  permissions?: Permissions
}

export function getEffectivePermissionsForUser(
  user: Pick<DbUser, "role"> & {
    pode_cadastrar_bem?: number | null
    pode_cadastro_provisorio_unidade?: number | null
  }
) {
  return getPermissions(
    user.role,
    resolveUserPermissionOverrides({
      role: user.role,
      podeCadastrarBem: user.pode_cadastrar_bem,
      podeCadastroProvisorioUnidade: user.pode_cadastro_provisorio_unidade,
    })
  )
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function getSessionMaxAge(channel: AuthSessionChannel = "web"): number {
  return channel === "mobile" ? MOBILE_SESSION_MAX_AGE_SECONDS : WEB_SESSION_MAX_AGE_SECONDS
}

export function sessionDaysToSeconds(days: number): number {
  return Math.max(1, Math.trunc(days)) * 24 * 60 * 60
}

function getJwtSecret(): string {
  const configuredSecret = process.env.JWT_SECRET?.trim()
  const secret = configuredSecret || DEFAULT_JWT_SECRET

  if (process.env.NODE_ENV === "production" && secret === DEFAULT_JWT_SECRET) {
    throw new Error("JWT_SECRET nao configurado com valor seguro para producao")
  }

  return secret
}

export function generateToken(
  user: { id: number; email: string; role: string; nome: string },
  channel: AuthSessionChannel = "web",
  maxAgeSeconds?: number
): string {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role, nome: user.nome, jti: crypto.randomUUID() } as JwtPayload,
    getJwtSecret(),
    { expiresIn: maxAgeSeconds ?? getSessionMaxAge(channel) }
  )
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as JwtPayload
  } catch {
    return null
  }
}

export async function setAuthCookie(
  token: string,
  channel: AuthSessionChannel = "web",
  maxAgeOverrideSeconds?: number
) {
  const cookieStore = await cookies()
  const maxAge = maxAgeOverrideSeconds ?? getSessionMaxAge(channel)

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: await shouldUseSecureAuthCookie(),
    sameSite: "lax",
    path: "/",
    maxAge,
  })
}

export async function clearAuthCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function getTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies()
  const cookie = cookieStore.get(COOKIE_NAME)
  return cookie?.value || null
}

export async function attachUserScopes(user: DbUser): Promise<ScopedDbUser> {
  const permissionOverrides = resolveUserPermissionOverrides({
    role: user.role,
    podeCadastrarBem: user.pode_cadastrar_bem,
    podeCadastroProvisorioUnidade: user.pode_cadastro_provisorio_unidade,
  })
  const permissions = getPermissions(user.role, permissionOverrides)

  try {
    await ensureUserScopeSchema()

    if (user.role === "gestor") {
      const secs = await query<{ secretaria: string }>(
        "SELECT secretaria FROM secretarias_gerenciadas WHERE usuario_id = ?",
        [user.id]
      )
      return {
        ...user,
        secretariasGerenciadas: secs.map((s) => s.secretaria).filter(Boolean),
        permissionOverrides,
        permissions,
      }
    }

    if (user.role === "assistente") {
      const deps = await query<{ departamento: string }>(
        "SELECT departamento FROM departamentos_assistente WHERE usuario_id = ? AND secretaria = ? ORDER BY departamento",
        [user.id, user.unidade_secretaria]
      )
      const departamentosAssistente = deps.map((d) => d.departamento).filter(Boolean)
      return {
        ...user,
        departamentosAssistente:
          departamentosAssistente.length > 0
            ? departamentosAssistente
            : user.unidade_departamento
              ? [user.unidade_departamento]
              : [],
        permissionOverrides,
        permissions,
      }
    }
  } catch (error) {
    console.error("[AUTH] Falha ao carregar escopos do usuario", {
      userId: user.id,
      role: user.role,
      secretaria: user.unidade_secretaria,
      error,
    })

    if (user.role === "gestor") {
      return { ...user, secretariasGerenciadas: [], permissionOverrides, permissions }
    }

    if (user.role === "assistente") {
      return {
        ...user,
        departamentosAssistente: user.unidade_departamento ? [user.unidade_departamento] : [],
        permissionOverrides,
        permissions,
      }
    }
  }

  return { ...user, permissionOverrides, permissions }
}

export async function getAuthUser(): Promise<ScopedDbUser | null> {
  const token = await getTokenFromCookie()
  if (!token) return null

  const payload = verifyToken(token)
  if (!payload) return null
  if (await isTokenBlacklisted({ token, payload })) return null

  const user = await queryOne<DbUser>(
    "SELECT * FROM usuarios WHERE id = ? AND ativo = 1",
    [payload.userId]
  )
  if (!user) return null
  return attachUserScopes(user)
}

export function getTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie") || ""
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
  if (match) return match[1]

  const authHeader = request.headers.get("authorization")
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7)
  }
  return null
}

export async function getAuthUserFromRequest(
  request: Request
): Promise<ScopedDbUser | null> {
  const token = getTokenFromRequest(request)
  if (!token) return null

  const payload = verifyToken(token)
  if (!payload) return null
  if (await isTokenBlacklisted({ token, payload })) return null

  const user = await queryOne<DbUser>(
    "SELECT * FROM usuarios WHERE id = ? AND ativo = 1",
    [payload.userId]
  )
  if (!user) return null
  return attachUserScopes(user)
}

export async function updateLastAccess(userId: number) {
  await execute("UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = ?", [userId])
}
