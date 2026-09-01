import { NextResponse } from "next/server"
import { execute, query } from "@/lib/db"
import { withRole } from "@/lib/api-auth"
import { registrarLog } from "@/lib/audit"
import {
  ensureSystemSettingsSchema,
  getSystemSettings,
  sanitizeSystemSettingsInput,
} from "@/lib/system-settings"

export const GET = withRole(["administrador"], async () => {
  const settings = await getSystemSettings()
  return NextResponse.json(settings)
})

export const PUT = withRole(["administrador"], async (request, { user }) => {
  await ensureSystemSettingsSchema()
  const body = sanitizeSystemSettingsInput(await request.json())

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
