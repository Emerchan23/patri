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

export async function ensureMovimentacaoSolicitacaoSchema() {
  if (schemaReady) return

  if (!(await tableExists("solicitacoes_movimentacao"))) {
    await execute(`
      CREATE TABLE solicitacoes_movimentacao (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        solicitante_usuario_id INT NOT NULL,
        solicitante_nome VARCHAR(255) NOT NULL,
        solicitante_role VARCHAR(50) NOT NULL,
        secretaria_origem VARCHAR(255) NOT NULL,
        secretaria_destino VARCHAR(255) NOT NULL,
        departamento_destino VARCHAR(255) NOT NULL,
        sala_destino VARCHAR(255) NOT NULL,
        motivo TEXT NOT NULL,
        status ENUM('pendente', 'aprovada', 'rejeitada', 'cancelada') NOT NULL DEFAULT 'pendente',
        motivo_rejeicao TEXT NULL,
        aprovado_por_usuario_id INT NULL,
        aprovado_por_nome VARCHAR(255) NULL,
        rejeitado_por_usuario_id INT NULL,
        rejeitado_por_nome VARCHAR(255) NULL,
        cancelado_por_usuario_id INT NULL,
        cancelado_por_nome VARCHAR(255) NULL,
        criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        decidido_em DATETIME NULL,
        cancelado_em DATETIME NULL,
        INDEX idx_solicitacao_status (status),
        INDEX idx_solicitacao_secretaria_origem (secretaria_origem),
        INDEX idx_solicitacao_secretaria_destino (secretaria_destino),
        INDEX idx_solicitacao_solicitante (solicitante_usuario_id),
        CONSTRAINT solicitacoes_movimentacao_ibfk_1
          FOREIGN KEY (solicitante_usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  }

  if (!(await tableExists("solicitacoes_movimentacao_itens"))) {
    await execute(`
      CREATE TABLE solicitacoes_movimentacao_itens (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        solicitacao_id INT NOT NULL,
        bem_id INT NOT NULL,
        patrimonio VARCHAR(100) NOT NULL,
        bem_descricao VARCHAR(255) NOT NULL,
        de_secretaria VARCHAR(255) NULL,
        de_departamento VARCHAR(255) NULL,
        de_sala VARCHAR(255) NULL,
        criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_solicitacao_item_solicitacao (solicitacao_id),
        INDEX idx_solicitacao_item_bem (bem_id),
        CONSTRAINT solicitacoes_movimentacao_itens_ibfk_1
          FOREIGN KEY (solicitacao_id) REFERENCES solicitacoes_movimentacao(id) ON DELETE CASCADE,
        CONSTRAINT solicitacoes_movimentacao_itens_ibfk_2
          FOREIGN KEY (bem_id) REFERENCES bens(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)
  }

  if (!(await columnExists("solicitacoes_movimentacao", "motivo_rejeicao"))) {
    await execute("ALTER TABLE solicitacoes_movimentacao ADD COLUMN motivo_rejeicao TEXT NULL AFTER status")
  }

  schemaReady = true
}
