import { NextResponse } from "next/server"
import { execute, query } from "@/lib/db"
import { withRole } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"
import {
  hasSystemSettingsSchema,
  getSystemSettings,
  sanitizeSystemSettingsInput,
  type SystemSettingsRecord,
} from "@/lib/system-settings"

const validThemeColors = ["blue", "green", "red", "orange", "purple", "slate"]
const validSidebarColors = ["light", "dark", "navy", "slate"]

function validHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 500) {
    return false
  }
  try {
    const url = new URL(value.trim())
    return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password
  } catch {
    return false
  }
}

function validSessionDays(value: unknown): boolean {
  const days = Number(value)
  return Number.isInteger(days) && days >= 1 && days <= 365
}

export const GET = withRole(["administrador"], async () => {
  const settings = await getSystemSettings()
  return NextResponse.json(settings)
})

export const PUT = withRole(["administrador"], async (request, { user }) => {
  if (!(await hasSystemSettingsSchema())) {
    return NextResponse.json(
      { error: "O schema de configurações não está pronto; aplique scripts/patch_system_settings_v15.sql." },
      { status: 409 }
    )
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 })
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Corpo da solicitação inválido." }, { status: 400 })
  }

  const input = payload as Partial<SystemSettingsRecord>
  if (
    typeof input.themeColor !== "string" || !validThemeColors.includes(input.themeColor) ||
    typeof input.sidebarColor !== "string" || !validSidebarColors.includes(input.sidebarColor) ||
    !validHttpUrl(input.linkExtensaoXml) || !validHttpUrl(input.linkPortalSefaz) ||
    !validSessionDays(input.sessionDaysWeb) || !validSessionDays(input.sessionDaysMobile)
  ) {
    return NextResponse.json(
      { error: "Revise cores, URLs HTTP/HTTPS (até 500 caracteres) e prazos de 1 a 365 dias." },
      { status: 400 }
    )
  }
  const body = sanitizeSystemSettingsInput(input)

  const existing = await query<Record<string, unknown>>("SELECT * FROM system_settings LIMIT 1")

  if (existing.length > 0) {
    await execute(
      `UPDATE system_settings
          SET theme_color=?,
              sidebar_color=?,
              link_extensao_xml=?,
              link_portal_sefaz=?,
              session_days_web=?,
              session_days_mobile=?
        WHERE id=?`,
      [
        body.themeColor,
        body.sidebarColor,
        body.linkExtensaoXml,
        body.linkPortalSefaz,
        body.sessionDaysWeb,
        body.sessionDaysMobile,
        existing[0].id,
      ]
    )
  } else {
    await execute(
      `INSERT INTO system_settings
        (theme_color, sidebar_color, link_extensao_xml, link_portal_sefaz, session_days_web, session_days_mobile)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        body.themeColor,
        body.sidebarColor,
        body.linkExtensaoXml,
        body.linkPortalSefaz,
        body.sessionDaysWeb,
        body.sessionDaysMobile,
      ]
    )
  }

  await registrarLog({
    acao: "edicao",
    descricao: "Configuracoes do sistema atualizadas",
    usuarioId: user.id,
    usuarioNome: user.nome,
    usuarioRole: user.role,
    entidadeTipo: "configuracao",
    entidadeId: "sistema",
    entidadeDescricao: "Configuracoes gerais e sessao",
    dadosAnteriores: existing.length > 0 ? existing[0] : undefined,
    dadosNovos: {
      themeColor: body.themeColor,
      sidebarColor: body.sidebarColor,
      linkExtensaoXml: body.linkExtensaoXml,
      linkPortalSefaz: body.linkPortalSefaz,
      sessionDaysWeb: body.sessionDaysWeb,
      sessionDaysMobile: body.sessionDaysMobile,
    },
  })

  return NextResponse.json({ success: true })
})
