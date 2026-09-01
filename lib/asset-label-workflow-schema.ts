import { execute, query } from "./db"

let schemaReady = false

async function columnExists(tableName: string, columnName: string) {
  const rows = await query<{ count: number }>(
    `SELECT COUNT(*) as count
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?`,
    [tableName, columnName]
  )
  return Number(rows[0]?.count || 0) > 0
}

export async function ensureAssetLabelWorkflowSchema() {
  if (schemaReady) return

  if (!(await columnExists("bens", "etiqueta_status"))) {
    await execute(
      "ALTER TABLE bens ADD COLUMN etiqueta_status ENUM('pendente','enviada','colada') NULL AFTER patrimonio_tipo"
    )
  }

  if (!(await columnExists("bens", "etiqueta_enviada_em"))) {
    await execute(
      "ALTER TABLE bens ADD COLUMN etiqueta_enviada_em DATETIME NULL AFTER etiqueta_status"
    )
  }

  if (!(await columnExists("bens", "etiqueta_enviada_por"))) {
    await execute(
      "ALTER TABLE bens ADD COLUMN etiqueta_enviada_por VARCHAR(255) NULL AFTER etiqueta_enviada_em"
    )
  }

  if (!(await columnExists("bens", "etiqueta_colada_em"))) {
    await execute(
      "ALTER TABLE bens ADD COLUMN etiqueta_colada_em DATETIME NULL AFTER etiqueta_enviada_por"
    )
  }

  if (!(await columnExists("bens", "etiqueta_colada_por"))) {
    await execute(
      "ALTER TABLE bens ADD COLUMN etiqueta_colada_por VARCHAR(255) NULL AFTER etiqueta_colada_em"
    )
  }

  await execute(
    "CREATE INDEX idx_bens_etiqueta_status ON bens (etiqueta_status)"
  ).catch(() => undefined)

  schemaReady = true
}
