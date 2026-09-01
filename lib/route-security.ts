import path from "path"
import { queryOne } from "./db"

export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()

  const xri = request.headers.get("x-real-ip")
  if (xri) return xri.trim()

  return "unknown"
}

export function isSafeFilenameSegment(filename: string): boolean {
  if (!filename) return false
  if (filename !== path.basename(filename)) return false
  return /^[A-Za-z0-9._-]+$/.test(filename)
}

export function maskSecret(secret: string): string {
  const normalized = String(secret || "")
  if (normalized.length <= 8) return "********"
  return `${normalized.slice(0, 4)}...${normalized.slice(-4)}`
}

export async function hasActiveApiKey(request: Request): Promise<boolean> {
  const apiKey = request.headers.get("x-api-key")?.trim()
  if (!apiKey) return false

  try {
    const row = await queryOne<{ id: number }>(
      "SELECT id FROM api_keys WHERE ativo = 1 AND chave = ? LIMIT 1",
      [apiKey]
    )

    return Boolean(row)
  } catch {
    return false
  }
}

export function isRuntimeSetupEnabled(): boolean {
  return process.env.ALLOW_RUNTIME_SETUP === "true"
}
