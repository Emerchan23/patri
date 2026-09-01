import { execute, query } from "./db"

let schemaReady = false

async function tableExists(tableName: string) {
  const rows = await query<{ count: number }>(
    `SELECT COUNT(*) as count
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ?`,
    [tableName]
  )
  return Number(rows[0]?.count || 0) > 0
}

export async function ensureUserScopeSchema() {
  if (schemaReady) return

  await execute(`
    ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS pode_cadastrar_bem TINYINT(1) NULL DEFAULT NULL
  `)

  await execute(`
    ALTER TABLE usuarios
    ADD COLUMN IF NOT EXISTS pode_cadastro_provisorio_unidade TINYINT(1) NULL DEFAULT NULL
  `)

  if (!(await tableExists("secretarias_gerenciadas"))) {
    await execute(`
      CREATE TABLE secretarias_gerenciadas (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
        secretaria VARCHAR(200) NOT NULL,
        criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_usuario_secretaria (usuario_id, secretaria),
        KEY idx_secretaria_gerenciada (secretaria),
        CONSTRAINT secretarias_gerenciadas_ibfk_1
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  }

  if (!(await tableExists("departamentos_assistente"))) {
    await execute(`
      CREATE TABLE departamentos_assistente (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
        secretaria VARCHAR(200) NOT NULL,
        departamento VARCHAR(200) NOT NULL,
        criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_assistente_departamento (usuario_id, secretaria, departamento),
        KEY idx_assistente_secretaria (secretaria),
        KEY idx_assistente_departamento (departamento),
        CONSTRAINT departamentos_assistente_ibfk_1
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  }

  schemaReady = true
}
