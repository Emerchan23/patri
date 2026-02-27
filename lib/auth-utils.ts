import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { cookies } from "next/headers"
import { query, queryOne, execute } from "./db"

const JWT_SECRET = process.env.JWT_SECRET || "sispatrimonio-secret-key-2025-change-in-production"
const TOKEN_EXPIRY = "8h"
const COOKIE_NAME = "sispatrimonio_token"

export interface JwtPayload {
  userId: number
  email: string
  role: string
  nome: string
}

export interface DbUser {
  id: number
  nome: string
  email: string
  senha_hash: string
  cargo: string
  role: "administrador" | "gestor" | "assistente"
  ativo: number
  avatar: string
  unidade_secretaria: string | null
  unidade_departamento: string | null
  criado_em: string
  ultimo_acesso: string | null
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateToken(user: { id: number; email: string; role: string; nome: string }): string {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role, nome: user.nome } as JwtPayload,
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  )
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload
  } catch {
    return null
  }
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies()
  
  // Em produção (Docker), muitas vezes não temos HTTPS configurado localmente/IP
  // Forçar secure=true quebra o login se não estiver usando HTTPS
  const isProduction = process.env.NODE_ENV === "production"
  
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    // Se estiver em produção mas sem HTTPS (ex: IP interno), secure deve ser false
    // Vamos deixar false por segurança para garantir que funcione em qualquer ambiente HTTP
    // Se o usuário configurar HTTPS no futuro, o cookie funcionará igual
    secure: false, 
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60, // 8 hours
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

export async function getAuthUser(): Promise<(DbUser & { secretariasGerenciadas?: string[] }) | null> {
  const token = await getTokenFromCookie()
  if (!token) return null

  const payload = verifyToken(token)
  if (!payload) return null

  const user = await queryOne<DbUser>(
    "SELECT * FROM usuarios WHERE id = ? AND ativo = 1",
    [payload.userId]
  )
  if (!user) return null

  // If gestor, also fetch managed secretarias
  if (user.role === "gestor") {
    const secs = await query<{ secretaria: string }>(
      "SELECT secretaria FROM secretarias_gerenciadas WHERE usuario_id = ?",
      [user.id]
    )
    return { ...user, secretariasGerenciadas: secs.map((s) => s.secretaria) }
  }

  return user
}

// Helper: get user from request headers (for API routes receiving token)
export function getTokenFromRequest(request: Request): string | null {
  // Try cookie first
  const cookieHeader = request.headers.get("cookie") || ""
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
  if (match) return match[1]

  // Try authorization header
  const authHeader = request.headers.get("authorization")
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7)
  }
  return null
}

export async function getAuthUserFromRequest(
  request: Request
): Promise<(DbUser & { secretariasGerenciadas?: string[] }) | null> {
  const token = getTokenFromRequest(request)
  if (!token) return null

  const payload = verifyToken(token)
  if (!payload) return null

  const user = await queryOne<DbUser>(
    "SELECT * FROM usuarios WHERE id = ? AND ativo = 1",
    [payload.userId]
  )
  if (!user) return null

  if (user.role === "gestor") {
    const secs = await query<{ secretaria: string }>(
      "SELECT secretaria FROM secretarias_gerenciadas WHERE usuario_id = ?",
      [user.id]
    )
    return { ...user, secretariasGerenciadas: secs.map((s) => s.secretaria) }
  }

  return user
}

// Update last access
export async function updateLastAccess(userId: number) {
  await execute("UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = ?", [userId])
}
