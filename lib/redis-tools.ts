import crypto from "crypto"
import { getRedis } from "./redis"

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex")
}

function tokenIdentifier(token: string, payload?: { jti?: string | undefined } | null) {
  if (payload?.jti) return `jti:${payload.jti}`
  return `sha:${sha256(token)}`
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  try {
    const redis = await getRedis()
    if (!redis) return null
    const raw = await redis.get(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch (error) {
    console.error("[REDIS] Falha ao ler chave JSON", { key, error })
    return null
  }
}

export async function cacheSetJson(key: string, value: unknown, ttlSeconds: number) {
  try {
    const redis = await getRedis()
    if (!redis) return
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds })
  } catch (error) {
    console.error("[REDIS] Falha ao gravar chave JSON", { key, ttlSeconds, error })
  }
}

export async function cacheDel(key: string) {
  try {
    const redis = await getRedis()
    if (!redis) return
    await redis.del(key)
  } catch (error) {
    console.error("[REDIS] Falha ao invalidar chave", { key, error })
  }
}

export async function cacheDelByPrefix(prefix: string) {
  try {
    const redis = await getRedis()
    if (!redis) return

    let cursor = 0
    do {
      const result = await redis.scan(cursor, {
        MATCH: `${prefix}*`,
        COUNT: 100,
      })
      cursor = Number(result.cursor)
      if (result.keys.length > 0) {
        await redis.del(result.keys)
      }
    } while (cursor !== 0)
  } catch (error) {
    console.error("[REDIS] Falha ao invalidar prefixo", { prefix, error })
  }
}

export async function checkRateLimit(params: {
  key: string
  limit: number
  windowSeconds: number
}): Promise<{ allowed: boolean; remaining: number; resetSeconds: number }> {
  try {
    const redis = await getRedis()
    if (!redis) return { allowed: true, remaining: params.limit, resetSeconds: params.windowSeconds }

    const current = await redis.incr(params.key)
    if (current === 1) {
      await redis.expire(params.key, params.windowSeconds)
    }

    const ttl = await redis.ttl(params.key)
    const resetSeconds = ttl > 0 ? ttl : params.windowSeconds
    const remaining = Math.max(0, params.limit - current)

    return { allowed: current <= params.limit, remaining, resetSeconds }
  } catch (error) {
    console.error("[REDIS] Falha no rate limit, liberando fallback", { key: params.key, error })
    return { allowed: true, remaining: params.limit, resetSeconds: params.windowSeconds }
  }
}

export async function blacklistToken(params: {
  token: string
  payload?: { jti?: string; exp?: number } | null
}) {
  try {
    const redis = await getRedis()
    if (!redis) return

    const id = tokenIdentifier(params.token, params.payload)
    const key = `auth:blacklist:${id}`

    let ttlSeconds = 8 * 60 * 60
    if (params.payload?.exp) {
      const now = Math.floor(Date.now() / 1000)
      ttlSeconds = Math.max(1, params.payload.exp - now)
    }

    await redis.set(key, "1", { EX: ttlSeconds })
  } catch (error) {
    console.error("[REDIS] Falha ao registrar blacklist de token", { error })
  }
}

export async function isTokenBlacklisted(params: { token: string; payload?: { jti?: string } | null }) {
  try {
    const redis = await getRedis()
    if (!redis) return false
    const id = tokenIdentifier(params.token, params.payload)
    const key = `auth:blacklist:${id}`
    const exists = await redis.exists(key)
    return exists === 1
  } catch (error) {
    console.error("[REDIS] Falha ao consultar blacklist de token", { error })
    return false
  }
}

