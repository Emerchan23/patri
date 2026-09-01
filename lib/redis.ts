import { createClient, type RedisClientType } from "redis"

const REDIS_URL = process.env.REDIS_URL
let hasLoggedDisabled = false

type GlobalWithRedis = typeof globalThis & {
  __sispatrimonioRedisClient?: RedisClientType
  __sispatrimonioRedisClientPromise?: Promise<RedisClientType>
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

  if (globalForRedis.__sispatrimonioRedisClient?.isOpen) {
    return globalForRedis.__sispatrimonioRedisClient
  }

  if (!globalForRedis.__sispatrimonioRedisClientPromise) {
    const client: RedisClientType = createClient({
      url: REDIS_URL,
      socket: {
        reconnectStrategy(retries) {
          const delay = Math.min(1000 * Math.max(1, retries), 5000)
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
    globalForRedis.__sispatrimonioRedisClientPromise = client
      .connect()
      .then(() => {
        console.log("[REDIS] Cliente conectado com sucesso.")
        globalForRedis.__sispatrimonioRedisClient = client
        return client
      })
      .catch((error) => {
        console.error("[REDIS] Falha ao conectar. Sistema usara fallback sem Redis.", error)
        globalForRedis.__sispatrimonioRedisClientPromise = undefined
        try {
          client.disconnect()
        } catch {}
        throw error
      })
  }

  return globalForRedis.__sispatrimonioRedisClientPromise
}

