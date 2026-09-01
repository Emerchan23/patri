import mysql from "mysql2/promise"
import { queryOne, query } from "./db"

export type LayoutPresetKey = "patrimonio_provisorio" | "qr_cadastro"

export interface EtiquetaPrintConfig {
  offsetXMm: number
  offsetYMm: number
  offsetColuna2Mm: number
  alturaExtraMm: number
  innerPaddingMm: number
}

export interface LabelLayoutConfig extends EtiquetaPrintConfig {
  presetKey: LayoutPresetKey
  title: string
  subtitle: string
  showDescription: boolean
  showEmenda: boolean
  showLocation: boolean
  showFooter: boolean
  showParent: boolean
  qrSizeMm: number
}

export interface EtiquetaSequenceInfo {
  nextSeq: number
  formatted: string
  source: "reuso" | "ajuste_manual" | "realinhamento_seguro" | "sequencia_normal"
  reuseCode: string | null
  manualSetting: number | null
}

export interface EtiquetaRealignmentInfo {
  nextSeq: number
  formatted: string
  source: "reuso" | "realinhamento_seguro" | "sequencia_normal"
  reusableCount: number
  gapsDetected: number
  nextReusableCode: string | null
  smallestGapSeq: number | null
  highestSeq: number
}

const DEFAULT_LAYOUT_CONFIG: Record<LayoutPresetKey, Omit<LabelLayoutConfig, "presetKey">> = {
  patrimonio_provisorio: {
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
  },
  qr_cadastro: {
    title: "Identificacao de Ambiente",
    subtitle: "",
    showDescription: false,
    showEmenda: false,
    showLocation: false,
    showFooter: true,
    showParent: true,
    qrSizeMm: 17,
    offsetXMm: 0,
    offsetYMm: 1,
    offsetColuna2Mm: 3,
    alturaExtraMm: 20,
    innerPaddingMm: 1.5,
  },
}

function formatCode(year: string, seq: number) {
  return `PROV-${year}-${String(seq).padStart(5, "0")}`
}

export function extractEtiquetaSequence(code: string, year: string) {
  const prefix = `PROV-${year}-`
  if (!code?.startsWith(prefix)) return null
  const suffix = code.slice(prefix.length)
  if (!/^\d+$/.test(suffix)) return null
  return parseInt(suffix, 10)
}

async function listUsedEtiquetaCodes(year: string, connection?: mysql.PoolConnection) {
  const prefix = `PROV-${year}-%`

  const etiquetaRows = await selectRows<{ codigo: string }>(
    `SELECT codigo
       FROM etiquetas_provisorias
      WHERE codigo LIKE ?
        AND status IN ('reservada', 'em_uso', 'usada', 'disponivel', 'disponivel_para_reuso')`,
    [prefix],
    connection
  )

  const bemRows = await selectRows<{ codigo: string | null }>(
    `SELECT patrimonio as codigo
       FROM bens
      WHERE patrimonio LIKE ?
      UNION
     SELECT patrimonio_provisorio as codigo
       FROM bens
      WHERE patrimonio_provisorio LIKE ?`,
    [prefix, prefix],
    connection
  )

  const usedCodes = new Set<string>()
  for (const row of etiquetaRows) {
    if (row.codigo) usedCodes.add(row.codigo)
  }
  for (const row of bemRows) {
    if (row.codigo) usedCodes.add(row.codigo)
  }

  return usedCodes
}

async function listCodesUsedByAssets(year: string, connection?: mysql.PoolConnection) {
  const prefix = `PROV-${year}-%`
  const bemRows = await selectRows<{ codigo: string | null }>(
    `SELECT patrimonio as codigo
       FROM bens
      WHERE patrimonio LIKE ?
      UNION
     SELECT patrimonio_provisorio as codigo
       FROM bens
      WHERE patrimonio_provisorio LIKE ?`,
    [prefix, prefix],
    connection
  )

  const usedCodes = new Set<string>()
  for (const row of bemRows) {
    if (row.codigo) usedCodes.add(row.codigo)
  }
  return usedCodes
}

async function selectRows<T = unknown>(
  sql: string,
  params?: unknown[],
  connection?: mysql.PoolConnection
): Promise<T[]> {
  if (connection) {
    const [rows] = await connection.execute(sql, params)
    return rows as T[]
  }
  return query<T>(sql, params)
}

export async function getEtiquetaPrintConfig(connection?: mysql.PoolConnection): Promise<EtiquetaPrintConfig> {
  const layout = await getLabelLayoutConfig("patrimonio_provisorio", connection)
  return {
    offsetXMm: layout.offsetXMm,
    offsetYMm: layout.offsetYMm,
    offsetColuna2Mm: layout.offsetColuna2Mm,
    alturaExtraMm: layout.alturaExtraMm,
    innerPaddingMm: layout.innerPaddingMm,
  }
}

export async function getLabelLayoutConfig(
  presetKey: LayoutPresetKey,
  connection?: mysql.PoolConnection
): Promise<LabelLayoutConfig> {
  const rows = await selectRows<{
    preset_key: LayoutPresetKey
    title: string | null
    subtitle: string | null
    show_description: number | null
    show_emenda: number | null
    show_location: number | null
    show_footer: number | null
    show_parent: number | null
    qr_size_mm: number | null
    offset_x_mm: number | null
    offset_y_mm: number | null
    offset_coluna_2_mm: number | null
    altura_extra_mm: number | null
    inner_padding_mm: number | null
  }>(
    `SELECT preset_key, title, subtitle, show_description, show_emenda, show_location, show_footer, show_parent, qr_size_mm,
            offset_x_mm, offset_y_mm, offset_coluna_2_mm, altura_extra_mm, inner_padding_mm
       FROM etiquetas_layout_settings
      WHERE preset_key = ?
      LIMIT 1`,
    [presetKey],
    connection
  )

  const defaults = DEFAULT_LAYOUT_CONFIG[presetKey]
  const row = rows[0]
  return {
    presetKey,
    title: String(row?.title ?? defaults.title),
    subtitle: String(row?.subtitle ?? defaults.subtitle),
    showDescription: Number(row?.show_description ?? (defaults.showDescription ? 1 : 0)) === 1,
    showEmenda: Number(row?.show_emenda ?? (defaults.showEmenda ? 1 : 0)) === 1,
    showLocation: Number(row?.show_location ?? (defaults.showLocation ? 1 : 0)) === 1,
    showFooter: Number(row?.show_footer ?? (defaults.showFooter ? 1 : 0)) === 1,
    showParent: Number(row?.show_parent ?? (defaults.showParent ? 1 : 0)) === 1,
    qrSizeMm: Number(row?.qr_size_mm ?? defaults.qrSizeMm),
    offsetXMm: Number(row?.offset_x_mm ?? defaults.offsetXMm),
    offsetYMm: Number(row?.offset_y_mm ?? defaults.offsetYMm),
    offsetColuna2Mm: Number(row?.offset_coluna_2_mm ?? defaults.offsetColuna2Mm),
    alturaExtraMm: Number(row?.altura_extra_mm ?? defaults.alturaExtraMm),
    innerPaddingMm: Number(row?.inner_padding_mm ?? defaults.innerPaddingMm),
  }
}

export async function getEtiquetaSequenceInfo(
  year: string,
  connection?: mysql.PoolConnection
): Promise<EtiquetaSequenceInfo> {
  const usedCodes = await listUsedEtiquetaCodes(year, connection)
  const assetUsedCodes = await listCodesUsedByAssets(year, connection)

  const reusableRows = await selectRows<{ codigo: string }>(
    `SELECT codigo
       FROM etiquetas_provisorias
      WHERE codigo LIKE ?
        AND status = 'disponivel_para_reuso'
      ORDER BY codigo ASC
      LIMIT 1`,
    [`PROV-${year}-%`],
    connection
  )

  const reusableCode = reusableRows.find((row) => row.codigo && !assetUsedCodes.has(row.codigo))?.codigo || null

  if (reusableCode) {
    return {
      nextSeq: extractEtiquetaSequence(reusableCode, year) || 1,
      formatted: reusableCode,
      source: "reuso",
      reuseCode: reusableCode,
      manualSetting: null,
    }
  }

  const manualSettingRow = await selectRows<{ proximo_numero_manual: number | null; origem_ajuste: "manual" | "realinhamento_seguro" | null }>(
    `SELECT proximo_numero_manual, origem_ajuste
       FROM etiquetas_provisorias_sequence_settings
      WHERE ano = ?
      LIMIT 1`,
    [year],
    connection
  )
  const manualSetting = manualSettingRow[0]?.proximo_numero_manual ?? null
  const origemAjuste = manualSettingRow[0]?.origem_ajuste ?? null

  let nextSeq = 1
  let highestSeq = 0
  for (const code of usedCodes) {
    const seq = extractEtiquetaSequence(code, year)
    if (seq && seq > highestSeq) {
      highestSeq = seq
    }
  }

  if (highestSeq > 0) {
    nextSeq = highestSeq + 1
  }

  if (manualSetting && Number(manualSetting) > 0) {
    nextSeq = Number(manualSetting)
  }

  return {
    nextSeq,
    formatted: formatCode(year, nextSeq),
    source: manualSetting ? (origemAjuste === "realinhamento_seguro" ? "realinhamento_seguro" : "ajuste_manual") : "sequencia_normal",
    reuseCode: null,
    manualSetting: manualSetting ? Number(manualSetting) : null,
  }
}

export async function analyzeEtiquetaRealignment(
  year: string,
  connection?: mysql.PoolConnection
): Promise<EtiquetaRealignmentInfo> {
  const rows = await selectRows<{ codigo: string; status: string }>(
    `SELECT codigo, status
       FROM etiquetas_provisorias
      WHERE codigo LIKE ?`,
    [`PROV-${year}-%`],
    connection
  )

  const usedCodes = await listUsedEtiquetaCodes(year, connection)
  const assetUsedCodes = await listCodesUsedByAssets(year, connection)

  const sequences = Array.from(usedCodes)
    .map((code) => extractEtiquetaSequence(code, year))
    .filter((seq): seq is number => typeof seq === "number" && seq > 0)
    .sort((a, b) => a - b)

  const highestSeq = sequences.length > 0 ? sequences[sequences.length - 1] : 0
  const sequenceSet = new Set(sequences)
  const reusableRows = rows
    .filter((row) => row.status === "disponivel_para_reuso" && row.codigo && !assetUsedCodes.has(row.codigo))
    .map((row) => ({
      codigo: row.codigo,
      seq: extractEtiquetaSequence(row.codigo, year) || 0,
    }))
    .filter((row) => row.seq > 0)
    .sort((a, b) => a.seq - b.seq)

  let gapsDetected = 0
  let smallestGapSeq: number | null = null

  for (let seq = 1; seq <= highestSeq; seq++) {
    if (!sequenceSet.has(seq)) {
      gapsDetected += 1
      if (smallestGapSeq === null) {
        smallestGapSeq = seq
      }
    }
  }

  if (reusableRows.length > 0) {
    const nextSeq = reusableRows[0].seq
    return {
      nextSeq,
      formatted: formatCode(year, nextSeq),
      source: "reuso",
      reusableCount: reusableRows.length,
      gapsDetected,
      nextReusableCode: reusableRows[0].codigo,
      smallestGapSeq,
      highestSeq,
    }
  }

  if (smallestGapSeq !== null) {
    return {
      nextSeq: smallestGapSeq,
      formatted: formatCode(year, smallestGapSeq),
      source: "realinhamento_seguro",
      reusableCount: 0,
      gapsDetected,
      nextReusableCode: null,
      smallestGapSeq,
      highestSeq,
    }
  }

  const nextSeq = highestSeq + 1 || 1
  return {
    nextSeq,
    formatted: formatCode(year, nextSeq),
    source: "sequencia_normal",
    reusableCount: 0,
    gapsDetected: 0,
    nextReusableCode: null,
    smallestGapSeq: null,
    highestSeq,
  }
}

export async function listFaixasLivres(year: string) {
  return query<{
    id: number
    ano: string
    seq_inicial: number
    seq_final: number
    quantidade_registrada: number
    observacao: string | null
    criado_por_nome: string | null
    criado_em: string
  }>(
    `SELECT id, ano, seq_inicial, seq_final, quantidade_registrada, observacao, criado_por_nome, criado_em
       FROM etiquetas_provisorias_faixas_livres
      WHERE ano = ?
      ORDER BY criado_em DESC, seq_inicial DESC`,
    [year]
  )
}

export async function getManualSequenceSetting(year: string) {
  return queryOne<{ proximo_numero_manual: number | null }>(
    `SELECT proximo_numero_manual
       FROM etiquetas_provisorias_sequence_settings
      WHERE ano = ?
      LIMIT 1`,
    [year]
  )
}
