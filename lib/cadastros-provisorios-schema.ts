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

export async function ensureCadastrosProvisoriosSchema() {
  if (schemaReady) return

  if (!(await tableExists("cadastros_provisorios_unidade"))) {
    await execute(`
      CREATE TABLE cadastros_provisorios_unidade (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        codigo VARCHAR(30) NULL,
        status VARCHAR(40) NOT NULL DEFAULT 'enviado_pela_unidade',
        solicitante_usuario_id INT NOT NULL,
        solicitante_nome VARCHAR(200) NOT NULL,
        origem_secretaria VARCHAR(200) NOT NULL,
        origem_departamento VARCHAR(200) NOT NULL,
        origem_sala VARCHAR(200) NOT NULL,
        descricao VARCHAR(255) NOT NULL,
        categoria_slug VARCHAR(120) NOT NULL,
        grupo VARCHAR(200) NULL,
        marca VARCHAR(200) NULL,
        modelo VARCHAR(200) NULL,
        fornecedor VARCHAR(255) NULL,
        numero_serie VARCHAR(255) NULL,
        quantidade INT NOT NULL DEFAULT 1,
        valor DECIMAL(12,2) NULL,
        estado_conservacao VARCHAR(50) NOT NULL DEFAULT 'novo',
        responsavel_nome VARCHAR(200) NULL,
        responsavel_cargo VARCHAR(200) NULL,
        observacoes TEXT NULL,
        imagem LONGTEXT NULL,
        nota_fiscal_url LONGTEXT NULL,
        emenda_parlamentar VARCHAR(255) NULL,
        tipo_entrada VARCHAR(50) NOT NULL DEFAULT 'compra',
        ajustado_por_usuario_id INT NULL,
        ajustado_por_nome VARCHAR(200) NULL,
        ajustado_em DATETIME NULL,
        encaminhado_patrimonio_em DATETIME NULL,
        aprovado_por_usuario_id INT NULL,
        aprovado_por_nome VARCHAR(200) NULL,
        aprovado_em DATETIME NULL,
        rejeitado_por_usuario_id INT NULL,
        rejeitado_por_nome VARCHAR(200) NULL,
        rejeitado_em DATETIME NULL,
        motivo_rejeicao TEXT NULL,
        devolvido_por_usuario_id INT NULL,
        devolvido_por_nome VARCHAR(200) NULL,
        devolvido_em DATETIME NULL,
        motivo_devolucao TEXT NULL,
        bem_definitivo_id INT NULL,
        criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_cadastro_provisorio_codigo (codigo),
        KEY idx_cadastro_provisorio_status (status),
        KEY idx_cadastro_provisorio_secretaria (origem_secretaria),
        KEY idx_cadastro_provisorio_departamento (origem_departamento),
        KEY idx_cadastro_provisorio_sala (origem_sala),
        KEY idx_cadastro_provisorio_solicitante (solicitante_usuario_id),
        CONSTRAINT fk_cadastro_provisorio_usuario
          FOREIGN KEY (solicitante_usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  }

  if (!(await tableExists("cadastros_provisorios_historico"))) {
    await execute(`
      CREATE TABLE cadastros_provisorios_historico (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        cadastro_provisorio_id INT NOT NULL,
        acao VARCHAR(60) NOT NULL,
        status_anterior VARCHAR(40) NULL,
        status_novo VARCHAR(40) NULL,
        usuario_id INT NOT NULL,
        usuario_nome VARCHAR(200) NOT NULL,
        usuario_role VARCHAR(50) NOT NULL,
        observacao TEXT NULL,
        dados_anteriores JSON NULL,
        dados_novos JSON NULL,
        criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_historico_cadastro (cadastro_provisorio_id),
        CONSTRAINT fk_historico_cadastro_provisorio
          FOREIGN KEY (cadastro_provisorio_id) REFERENCES cadastros_provisorios_unidade(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  }

  schemaReady = true
}
