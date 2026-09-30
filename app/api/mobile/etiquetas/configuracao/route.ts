import { NextResponse } from "next/server"
import { query, queryOne } from "@/lib/db"
import { withPermission } from "@/lib/api-auth"

export const dynamic = "force-dynamic"

const defaultLayout = {
  presetKey: "patrimonio_provisorio",
  title: "",
  subtitle: "",
  showDescription: true,
  showEmenda: true,
  showLocation: false,
  showFooter: true,
  showParent: false,
  qrSizeMm: 16,
  offsetXMm: 0,
  offsetYMm: 1,
  offsetColuna2Mm: 3,
  alturaExtraMm: 20,
  innerPaddingMm: 1.5,
}

const columns = [
  "preset_key",
  "title",
  "subtitle",
  "show_description",
  "show_emenda",
  "show_location",
  "show_footer",
  "show_parent",
  "qr_size_mm",
  "offset_x_mm",
  "offset_y_mm",
  "offset_coluna_2_mm",
  "altura_extra_mm",
  "inner_padding_mm",
]

export const GET = withPermission("gerarEtiquetas", async () => {
  const table = await queryOne<{ table_name: string }>(
    `SELECT TABLE_NAME AS table_name
       FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'etiquetas_layout_settings'
      LIMIT 1`,
  )
  if (!table) return NextResponse.json({ data: defaultLayout, source: "default" })

  const available = await query<{ column_name: string }>(
    `SELECT COLUMN_NAME AS column_name
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'etiquetas_layout_settings'
        AND COLUMN_NAME IN (${columns.map(() => "?").join(", ")})`,
    columns,
  )
  if (available.length !== columns.length) {
    return NextResponse.json({ data: defaultLayout, source: "default" })
  }

  const row = await queryOne<Record<string, unknown>>(
    `SELECT preset_key, title, subtitle, show_description, show_emenda, show_location, show_footer,
            show_parent, qr_size_mm, offset_x_mm, offset_y_mm, offset_coluna_2_mm,
            altura_extra_mm, inner_padding_mm
       FROM etiquetas_layout_settings
      WHERE preset_key = 'patrimonio_provisorio'
      LIMIT 1`,
  )
  if (!row) return NextResponse.json({ data: defaultLayout, source: "default" })

  return NextResponse.json({
    source: "system",
    data: {
      presetKey: "patrimonio_provisorio",
      title: String(row.title ?? defaultLayout.title),
      subtitle: String(row.subtitle ?? defaultLayout.subtitle),
      showDescription: Number(row.show_description ?? 1) === 1,
      showEmenda: Number(row.show_emenda ?? 1) === 1,
      showLocation: Number(row.show_location ?? 0) === 1,
      showFooter: Number(row.show_footer ?? 1) === 1,
      showParent: Number(row.show_parent ?? 0) === 1,
      qrSizeMm: Number(row.qr_size_mm ?? defaultLayout.qrSizeMm),
      offsetXMm: Number(row.offset_x_mm ?? defaultLayout.offsetXMm),
      offsetYMm: Number(row.offset_y_mm ?? defaultLayout.offsetYMm),
      offsetColuna2Mm: Number(row.offset_coluna_2_mm ?? defaultLayout.offsetColuna2Mm),
      alturaExtraMm: Number(row.altura_extra_mm ?? defaultLayout.alturaExtraMm),
      innerPaddingMm: Number(row.inner_padding_mm ?? defaultLayout.innerPaddingMm),
    },
  })
})
