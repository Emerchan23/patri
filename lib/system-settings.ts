import { execute, queryOne } from "./db"

export const DEFAULT_WEB_SESSION_DAYS = 3
export const DEFAULT_MOBILE_SESSION_DAYS = 30
export const MIN_SESSION_DAYS = 1
export const MAX_SESSION_DAYS = 365
const DEFAULT_XML_EXTENSION_LINK =
  "https://chromewebstore.google.com/detail/fsist-download-xml-nfe/jclbljmbidghoecicnjofjldjndabajp"
const DEFAULT_SEFAZ_PORTAL_LINK = "https://www.fsist.com.br/"

let schemaReady = false

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

export async function ensureSystemSettingsSchema() {
  if (schemaReady) return

  await execute(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      theme_color VARCHAR(50) DEFAULT 'blue',
      sidebar_color VARCHAR(50) DEFAULT 'dark',
      link_extensao_xml VARCHAR(500) DEFAULT '${DEFAULT_XML_EXTENSION_LINK}',
      link_portal_sefaz VARCHAR(500) DEFAULT '${DEFAULT_SEFAZ_PORTAL_LINK}',
      session_days_web INT NOT NULL DEFAULT ${DEFAULT_WEB_SESSION_DAYS},
      session_days_mobile INT NOT NULL DEFAULT ${DEFAULT_MOBILE_SESSION_DAYS},
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `)

  try {
    await execute(
      `ALTER TABLE system_settings
       ADD COLUMN link_extensao_xml VARCHAR(500) DEFAULT '${DEFAULT_XML_EXTENSION_LINK}'`
    )
  } catch {}

  try {
    await execute(
      `ALTER TABLE system_settings
       ADD COLUMN link_portal_sefaz VARCHAR(500) DEFAULT '${DEFAULT_SEFAZ_PORTAL_LINK}'`
    )
  } catch {}

  try {
    await execute(
      `ALTER TABLE system_settings
       ADD COLUMN session_days_web INT NOT NULL DEFAULT ${DEFAULT_WEB_SESSION_DAYS}`
    )
  } catch {}

  try {
    await execute(
      `ALTER TABLE system_settings
       ADD COLUMN session_days_mobile INT NOT NULL DEFAULT ${DEFAULT_MOBILE_SESSION_DAYS}`
    )
  } catch {}

  const count = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM system_settings")
  if (count && count.count === 0) {
    await execute(
      `INSERT INTO system_settings
        (id, theme_color, sidebar_color, link_extensao_xml, link_portal_sefaz, session_days_web, session_days_mobile)
       VALUES (1, 'blue', 'dark', ?, ?, ?, ?)` ,
      [DEFAULT_XML_EXTENSION_LINK, DEFAULT_SEFAZ_PORTAL_LINK, DEFAULT_WEB_SESSION_DAYS, DEFAULT_MOBILE_SESSION_DAYS]
    )
  }

  schemaReady = true
}

export async function getSystemSettings(): Promise<SystemSettingsRecord> {
  await ensureSystemSettingsSchema()

  const defaults = getDefaultSystemSettings()
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
