import { NextResponse } from "next/server"
import { execute } from "@/lib/db"
import { withAuth } from "@/lib/api-auth"
import { ensureEtiquetasSchema } from "@/lib/etiquetas-schema"
import { getEtiquetaSequenceInfo, getLabelLayoutConfig, listFaixasLivres, type LayoutPresetKey } from "@/lib/etiquetas-sequence"

function normalizePresetKey(value: string | null): LayoutPresetKey {
  return value === "qr_cadastro" ? "qr_cadastro" : "patrimonio_provisorio"
}

export const GET = withAuth(async (request) => {
  await ensureEtiquetasSchema()
  const url = new URL(request.url)
  const ano = url.searchParams.get("ano") || new Date().getFullYear().toString()
  const preset = normalizePresetKey(url.searchParams.get("preset"))

  const layoutConfig = await getLabelLayoutConfig(preset)

  if (preset === "qr_cadastro") {
    return NextResponse.json({
      preset,
      layoutConfig,
    })
  }

  const [sequenceInfo, faixasLivres] = await Promise.all([
    getEtiquetaSequenceInfo(ano),
    listFaixasLivres(ano),
  ])

  return NextResponse.json({
    preset,
    layoutConfig,
    printConfig: layoutConfig,
    sequence: sequenceInfo,
    faixasLivres,
  })
})

export const PUT = withAuth(async (request, { user }) => {
  await ensureEtiquetasSchema()
  const body = await request.json()
  const ano = String(body.ano || new Date().getFullYear()).slice(0, 4)
  const preset = normalizePresetKey(body.preset || body.presetKey || null)
  const proximoNumeroManual = body.proximoNumeroManual ? Number(body.proximoNumeroManual) : null

  const layoutInput = body.layoutConfig || body.printConfig || {}
  const title = String(layoutInput.title ?? body.title ?? "").trim()
  const subtitle = String(layoutInput.subtitle ?? body.subtitle ?? "").trim()
  const showDescription = layoutInput.showDescription === undefined ? true : Boolean(layoutInput.showDescription)
  const showEmenda = layoutInput.showEmenda === undefined ? true : Boolean(layoutInput.showEmenda)
  const showLocation = layoutInput.showLocation === undefined ? false : Boolean(layoutInput.showLocation)
  const showFooter = layoutInput.showFooter === undefined ? true : Boolean(layoutInput.showFooter)
  const showParent = layoutInput.showParent === undefined ? false : Boolean(layoutInput.showParent)
  const qrSizeMm = Number(layoutInput.qrSizeMm ?? 16)
  const offsetXMm = Number(layoutInput.offsetXMm ?? 0)
  const offsetYMm = Number(layoutInput.offsetYMm ?? 1)
  const offsetColuna2Mm = Number(layoutInput.offsetColuna2Mm ?? 3)
  const alturaExtraMm = Number(layoutInput.alturaExtraMm ?? 20)
  const innerPaddingMm = Number(layoutInput.innerPaddingMm ?? 1.5)

  await execute(
    `INSERT INTO etiquetas_layout_settings
      (preset_key, title, subtitle, show_description, show_emenda, show_location, show_footer, show_parent, qr_size_mm,
       offset_x_mm, offset_y_mm, offset_coluna_2_mm, altura_extra_mm, inner_padding_mm, atualizado_por_usuario_id, atualizado_por_nome)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       title = VALUES(title),
       subtitle = VALUES(subtitle),
       show_description = VALUES(show_description),
       show_emenda = VALUES(show_emenda),
       show_location = VALUES(show_location),
       show_footer = VALUES(show_footer),
       show_parent = VALUES(show_parent),
       qr_size_mm = VALUES(qr_size_mm),
       offset_x_mm = VALUES(offset_x_mm),
       offset_y_mm = VALUES(offset_y_mm),
       offset_coluna_2_mm = VALUES(offset_coluna_2_mm),
       altura_extra_mm = VALUES(altura_extra_mm),
       inner_padding_mm = VALUES(inner_padding_mm),
       atualizado_por_usuario_id = VALUES(atualizado_por_usuario_id),
       atualizado_por_nome = VALUES(atualizado_por_nome)`,
    [
      preset,
      title,
      subtitle,
      showDescription ? 1 : 0,
      showEmenda ? 1 : 0,
      showLocation ? 1 : 0,
      showFooter ? 1 : 0,
      showParent ? 1 : 0,
      qrSizeMm,
      offsetXMm,
      offsetYMm,
      offsetColuna2Mm,
      alturaExtraMm,
      innerPaddingMm,
      user.id,
      user.nome,
    ]
  )

  if (preset === "patrimonio_provisorio") {
    await execute(
      `INSERT INTO etiquetas_provisorias_sequence_settings
        (ano, proximo_numero_manual, origem_ajuste, atualizado_por_usuario_id, atualizado_por_nome)
       VALUES (?, ?, 'manual', ?, ?)
       ON DUPLICATE KEY UPDATE
         proximo_numero_manual = VALUES(proximo_numero_manual),
         origem_ajuste = VALUES(origem_ajuste),
         atualizado_por_usuario_id = VALUES(atualizado_por_usuario_id),
         atualizado_por_nome = VALUES(atualizado_por_nome)`,
      [ano, proximoNumeroManual, user.id, user.nome]
    )
  }

  const layoutConfig = await getLabelLayoutConfig(preset)

  if (preset === "qr_cadastro") {
    return NextResponse.json({
      success: true,
      preset,
      layoutConfig,
    })
  }

  const [sequenceInfo, faixasLivres] = await Promise.all([
    getEtiquetaSequenceInfo(ano),
    listFaixasLivres(ano),
  ])

  return NextResponse.json({
    success: true,
    preset,
    layoutConfig,
    printConfig: layoutConfig,
    sequence: sequenceInfo,
    faixasLivres,
  })
})
