import { query, queryOne } from "./db"

export const DEFAULT_WEB_SESSION_DAYS = 3
export const DEFAULT_MOBILE_SESSION_DAYS = 30
export const MIN_SESSION_DAYS = 1
export const MAX_SESSION_DAYS = 365
const DEFAULT_XML_EXTENSION_LINK =
  "https://chromewebstore.google.com/detail/fsist-download-xml-nfe/jclbljmbidghoecicnjofjldjndabajp"
const DEFAULT_SEFAZ_PORTAL_LINK = "https://www.fsist.com.br/"

const SYSTEM_SETTINGS_COLUMNS = [
  "id",
  "theme_color",
  "sidebar_color",
  "link_extensao_xml",
  "link_portal_sefaz",
  "session_days_web",
  "session_days_mobile",
]

export interface SystemSettingsRecord {
  themeColor: string
  sidebarColor: string
  linkExtensaoXml: string
  linkPortalSefaz: string
  sessionDaysWeb: number
  sessionDaysMobile: number
}

function normalizeSessionDays(value: unknown, fallback: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const rounded = Math.trunc(parsed)
  if (rounded < MIN_SESSION_DAYS) return MIN_SESSION_DAYS
  if (rounded > MAX_SESSION_DAYS) return MAX_SESSION_DAYS
  return rounded
}

export function getDefaultSystemSettings(): SystemSettingsRecord {
  return {
    themeColor: "blue",
    sidebarColor: "dark",
    linkExtensaoXml: DEFAULT_XML_EXTENSION_LINK,
    linkPortalSefaz: DEFAULT_SEFAZ_PORTAL_LINK,
    sessionDaysWeb: DEFAULT_WEB_SESSION_DAYS,
    sessionDaysMobile: DEFAULT_MOBILE_SESSION_DAYS,
  }
}

export async function hasSystemSettingsSchema(): Promise<boolean> {
  const rows = await query<{ COLUMN_NAME: string }>(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    ["system_settings"]
  )
  const columns = new Set(rows.map((row) => row.COLUMN_NAME.toLowerCase()))
  return SYSTEM_SETTINGS_COLUMNS.every((column) => columns.has(column))
}

export async function getSystemSettings(): Promise<SystemSettingsRecord> {
  const defaults = getDefaultSystemSettings()
  const table = await queryOne<{ tableName: string }>(
    `SELECT TABLE_NAME AS tableName
       FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    ["system_settings"]
  )
  if (!table) return defaults

  const row = await queryOne<Record<string, unknown>>("SELECT * FROM system_settings LIMIT 1")
  if (!row) return defaults

  return {
    themeColor: String(row.theme_color || defaults.themeColor),
    sidebarColor: String(row.sidebar_color || defaults.sidebarColor),
    linkExtensaoXml: String(row.link_extensao_xml || defaults.linkExtensaoXml),
    linkPortalSefaz: String(row.link_portal_sefaz || defaults.linkPortalSefaz),
    sessionDaysWeb: normalizeSessionDays(row.session_days_web, defaults.sessionDaysWeb),
    sessionDaysMobile: normalizeSessionDays(row.session_days_mobile, defaults.sessionDaysMobile),
  }
}

export function sanitizeSystemSettingsInput(body: Partial<SystemSettingsRecord>): SystemSettingsRecord {
  const defaults = getDefaultSystemSettings()

  return {
    themeColor: String(body.themeColor || defaults.themeColor),
    sidebarColor: String(body.sidebarColor || defaults.sidebarColor),
    linkExtensaoXml: String(body.linkExtensaoXml || defaults.linkExtensaoXml),
    linkPortalSefaz: String(body.linkPortalSefaz || defaults.linkPortalSefaz),
    sessionDaysWeb: normalizeSessionDays(body.sessionDaysWeb, defaults.sessionDaysWeb),
    sessionDaysMobile: normalizeSessionDays(body.sessionDaysMobile, defaults.sessionDaysMobile),
  }
}
