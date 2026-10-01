import { createClient, type RedisClientType } from "redis"

const REDIS_URL = process.env.REDIS_URL
const REDIS_CONNECT_TIMEOUT_MS = 1500
const REDIS_RETRY_COOLDOWN_MS = 5000
let hasLoggedDisabled = false

type GlobalWithRedis = typeof globalThis & {
  __sispatrimonioRedisClient?: RedisClientType
  __sispatrimonioRedisClientPromise?: Promise<RedisClientType | null>
  __sispatrimonioRedisRetryAfter?: number
}

export async function getRedis(): Promise<RedisClientType | null> {
  if (!REDIS_URL) {
    if (!hasLoggedDisabled) {
      hasLoggedDisabled = true
      console.warn("[REDIS] REDIS_URL nao configurada. Sistema seguira sem cache Redis.")
    }
    return null
  }

  const globalForRedis = globalThis as GlobalWithRedis

  if (
    globalForRedis.__sispatrimonioRedisRetryAfter &&
    Date.now() < globalForRedis.__sispatrimonioRedisRetryAfter
  ) {
    return null
  }

  if (globalForRedis.__sispatrimonioRedisClient?.isOpen) {
    return globalForRedis.__sispatrimonioRedisClient
  }

  if (!globalForRedis.__sispatrimonioRedisClientPromise) {
    const client: RedisClientType = createClient({
      url: REDIS_URL,
      socket: {
        connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
        reconnectStrategy(retries) {
          if (retries >= 2) {
            return new Error("Redis indisponivel apos duas tentativas; usando fallback.")
          }
          const delay = Math.min(250 * 2 ** retries, 1000)
          console.warn(`[REDIS] Tentando reconectar (${retries}). Proxima tentativa em ${delay}ms.`)
          return delay
        },
      },
    })
    client.on("error", (error) => {
      console.error("[REDIS] Erro de conexao:", error)
    })
    client.on("reconnecting", () => {
      console.warn("[REDIS] Reconectando...")
    })
    client.on("ready", () => {
      console.log("[REDIS] Conexao pronta.")
    })
    client.on("end", () => {
      if (globalForRedis.__sispatrimonioRedisClient === client) {
        globalForRedis.__sispatrimonioRedisClient = undefined
        globalForRedis.__sispatrimonioRedisClientPromise = undefined
        globalForRedis.__sispatrimonioRedisRetryAfter =
          Date.now() + REDIS_RETRY_COOLDOWN_MS
      }
    })
    globalForRedis.__sispatrimonioRedisClientPromise = client
      .connect()
      .then(() => {
        console.log("[REDIS] Cliente conectado com sucesso.")
        globalForRedis.__sispatrimonioRedisRetryAfter = undefined
        globalForRedis.__sispatrimonioRedisClient = client
        return client
      })
      .catch((error): null => {
        console.error("[REDIS] Falha ao conectar. Sistema usara fallback sem Redis.", error)
        globalForRedis.__sispatrimonioRedisClientPromise = undefined
        globalForRedis.__sispatrimonioRedisRetryAfter =
          Date.now() + REDIS_RETRY_COOLDOWN_MS
        void client.disconnect().catch(() => undefined)
        return null
      })
  }

  return globalForRedis.__sispatrimonioRedisClientPromise
}

