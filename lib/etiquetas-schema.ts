import { query, execute } from "./db"

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

export async function ensureEtiquetasSchema() {
  if (schemaReady) return

  await execute(`
    CREATE TABLE IF NOT EXISTS etiquetas_provisorias_lotes (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      ano VARCHAR(4) NOT NULL,
      quantidade INT NOT NULL,
      origem_reserva ENUM('automatico', 'faixa_manual') NOT NULL DEFAULT 'automatico',
      faixa_inicial VARCHAR(50) NOT NULL,
      faixa_final VARCHAR(50) NOT NULL,
      status ENUM('reservado', 'parcialmente_usado', 'usado', 'cancelado') NOT NULL DEFAULT 'reservado',
      observacao TEXT NULL,
      emenda_parlamentar VARCHAR(255) NULL,
      criado_por_usuario_id INT NULL,
      criado_por_nome VARCHAR(255) NULL,
      criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_lote_status (status),
      INDEX idx_lote_ano (ano)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  if (!(await columnExists("etiquetas_provisorias_lotes", "origem_reserva"))) {
    await execute(
      "ALTER TABLE etiquetas_provisorias_lotes ADD COLUMN origem_reserva ENUM('automatico', 'faixa_manual') NOT NULL DEFAULT 'automatico' AFTER quantidade"
    )
  }

  await execute(`
    CREATE TABLE IF NOT EXISTS etiquetas_provisorias_sequence_settings (
      ano VARCHAR(4) NOT NULL PRIMARY KEY,
      proximo_numero_manual INT NULL,
      origem_ajuste ENUM('manual', 'realinhamento_seguro') NULL,
      atualizado_por_usuario_id INT NULL,
      atualizado_por_nome VARCHAR(255) NULL,
      atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  if (!(await columnExists("etiquetas_provisorias_sequence_settings", "origem_ajuste"))) {
    await execute(
      "ALTER TABLE etiquetas_provisorias_sequence_settings ADD COLUMN origem_ajuste ENUM('manual', 'realinhamento_seguro') NULL AFTER proximo_numero_manual"
    )
  }

  await execute(`
    CREATE TABLE IF NOT EXISTS etiquetas_provisorias_faixas_livres (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      ano VARCHAR(4) NOT NULL,
      seq_inicial INT NOT NULL,
      seq_final INT NOT NULL,
      quantidade_registrada INT NOT NULL,
      observacao TEXT NULL,
      criado_por_usuario_id INT NULL,
      criado_por_nome VARCHAR(255) NULL,
      criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_faixa_livre_ano (ano),
      INDEX idx_faixa_livre_intervalo (ano, seq_inicial, seq_final)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS etiquetas_provisorias_realinhamentos (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      ano VARCHAR(4) NOT NULL,
      proximo_numero_aplicado INT NOT NULL,
      origem_resultado ENUM('reuso', 'realinhamento_seguro', 'sequencia_normal') NOT NULL,
      lacunas_detectadas INT NOT NULL DEFAULT 0,
      reutilizaveis_encontrados INT NOT NULL DEFAULT 0,
      criado_por_usuario_id INT NULL,
      criado_por_nome VARCHAR(255) NULL,
      criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_realinhamento_ano (ano),
      INDEX idx_realinhamento_criado (criado_em)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS etiquetas_print_settings (
      id INT NOT NULL PRIMARY KEY,
      offset_x_mm DECIMAL(8,2) NOT NULL DEFAULT 0,
      offset_y_mm DECIMAL(8,2) NOT NULL DEFAULT 1,
      offset_coluna_2_mm DECIMAL(8,2) NOT NULL DEFAULT 3,
      altura_extra_mm DECIMAL(8,2) NOT NULL DEFAULT 20,
      inner_padding_mm DECIMAL(8,2) NOT NULL DEFAULT 1.5,
      atualizado_por_usuario_id INT NULL,
      atualizado_por_nome VARCHAR(255) NULL,
      atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS etiquetas_layout_settings (
      preset_key VARCHAR(50) NOT NULL PRIMARY KEY,
      title VARCHAR(255) NULL,
      subtitle VARCHAR(255) NULL,
      show_description TINYINT(1) NOT NULL DEFAULT 1,
      show_emenda TINYINT(1) NOT NULL DEFAULT 1,
      show_location TINYINT(1) NOT NULL DEFAULT 0,
      show_footer TINYINT(1) NOT NULL DEFAULT 1,
      show_parent TINYINT(1) NOT NULL DEFAULT 0,
      qr_size_mm DECIMAL(8,2) NOT NULL DEFAULT 16,
      offset_x_mm DECIMAL(8,2) NOT NULL DEFAULT 0,
      offset_y_mm DECIMAL(8,2) NOT NULL DEFAULT 1,
      offset_coluna_2_mm DECIMAL(8,2) NOT NULL DEFAULT 3,
      altura_extra_mm DECIMAL(8,2) NOT NULL DEFAULT 20,
      inner_padding_mm DECIMAL(8,2) NOT NULL DEFAULT 1.5,
      atualizado_por_usuario_id INT NULL,
      atualizado_por_nome VARCHAR(255) NULL,
      atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  await execute(`
    INSERT INTO etiquetas_print_settings
      (id, offset_x_mm, offset_y_mm, offset_coluna_2_mm, altura_extra_mm, inner_padding_mm)
    VALUES (1, 0, 1, 3, 20, 1.5)
    ON DUPLICATE KEY UPDATE id = id
  `)

  await execute(`
    INSERT INTO etiquetas_layout_settings
      (preset_key, title, subtitle, show_description, show_emenda, show_location, show_footer, show_parent, qr_size_mm,
       offset_x_mm, offset_y_mm, offset_coluna_2_mm, altura_extra_mm, inner_padding_mm)
    VALUES
      ('patrimonio_provisorio', '', '', 1, 1, 0, 1, 0, 16, 0, 1, 3, 20, 1.5),
      ('qr_cadastro', 'Identificacao de Ambiente', '', 0, 0, 0, 1, 1, 17, 0, 1, 3, 20, 1.5)
    ON DUPLICATE KEY UPDATE preset_key = preset_key
  `)

  await execute(`
    UPDATE etiquetas_layout_settings layout
    JOIN etiquetas_print_settings legacy ON legacy.id = 1
       SET layout.offset_x_mm = legacy.offset_x_mm,
           layout.offset_y_mm = legacy.offset_y_mm,
           layout.offset_coluna_2_mm = legacy.offset_coluna_2_mm,
           layout.altura_extra_mm = legacy.altura_extra_mm,
           layout.inner_padding_mm = legacy.inner_padding_mm
     WHERE layout.preset_key = 'patrimonio_provisorio'
  `)

  if (!(await tableExists("etiquetas_provisorias"))) {
    await execute(`
      CREATE TABLE etiquetas_provisorias (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        codigo VARCHAR(50) NOT NULL UNIQUE,
        gerado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        status ENUM('reservada', 'em_uso', 'usada', 'cancelada', 'disponivel_para_reuso') NOT NULL DEFAULT 'reservada',
        bem_id INT NULL,
        lote_id INT NULL,
        observacao TEXT NULL,
        emenda_parlamentar VARCHAR(255) NULL,
        reservado_por_usuario_id INT NULL,
        reservado_por_nome VARCHAR(255) NULL,
        cancelado_em DATETIME NULL,
        usado_em DATETIME NULL,
        INDEX idx_etiqueta_status (status),
        INDEX idx_etiqueta_lote (lote_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  } else {
    await execute(`
      ALTER TABLE etiquetas_provisorias
      MODIFY COLUMN status ENUM('reservada', 'em_uso', 'usada', 'cancelada', 'disponivel_para_reuso', 'disponivel')
      NOT NULL DEFAULT 'reservada'
    `)

    if (!(await columnExists("etiquetas_provisorias", "lote_id"))) {
      await execute("ALTER TABLE etiquetas_provisorias ADD COLUMN lote_id INT NULL AFTER bem_id")
    }
    if (!(await columnExists("etiquetas_provisorias", "observacao"))) {
      await execute("ALTER TABLE etiquetas_provisorias ADD COLUMN observacao TEXT NULL AFTER lote_id")
    }
    if (!(await columnExists("etiquetas_provisorias", "emenda_parlamentar"))) {
      await execute("ALTER TABLE etiquetas_provisorias ADD COLUMN emenda_parlamentar VARCHAR(255) NULL AFTER observacao")
    }
    if (!(await columnExists("etiquetas_provisorias", "reservado_por_usuario_id"))) {
      await execute("ALTER TABLE etiquetas_provisorias ADD COLUMN reservado_por_usuario_id INT NULL AFTER emenda_parlamentar")
    }
    if (!(await columnExists("etiquetas_provisorias", "reservado_por_nome"))) {
      await execute("ALTER TABLE etiquetas_provisorias ADD COLUMN reservado_por_nome VARCHAR(255) NULL AFTER reservado_por_usuario_id")
    }
    if (!(await columnExists("etiquetas_provisorias", "cancelado_em"))) {
      await execute("ALTER TABLE etiquetas_provisorias ADD COLUMN cancelado_em DATETIME NULL AFTER reservado_por_nome")
    }
    if (!(await columnExists("etiquetas_provisorias", "usado_em"))) {
      await execute("ALTER TABLE etiquetas_provisorias ADD COLUMN usado_em DATETIME NULL AFTER cancelado_em")
    }
  }

  schemaReady = true
}
