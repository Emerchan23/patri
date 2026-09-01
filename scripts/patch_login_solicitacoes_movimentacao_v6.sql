-- Patch incremental para login resiliente de escopo e solicitacoes de mudanca
-- Data: 2026-05-15

USE sispatrimonio;

CREATE TABLE IF NOT EXISTS secretarias_gerenciadas (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  secretaria VARCHAR(200) NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_usuario_secretaria (usuario_id, secretaria),
  KEY idx_secretaria_gerenciada (secretaria),
  CONSTRAINT secretarias_gerenciadas_ibfk_1
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS solicitacoes_movimentacao (
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
  motivo_rejeicao TEXT DEFAULT NULL,
  aprovado_por_usuario_id INT DEFAULT NULL,
  aprovado_por_nome VARCHAR(255) DEFAULT NULL,
  rejeitado_por_usuario_id INT DEFAULT NULL,
  rejeitado_por_nome VARCHAR(255) DEFAULT NULL,
  cancelado_por_usuario_id INT DEFAULT NULL,
  cancelado_por_nome VARCHAR(255) DEFAULT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decidido_em DATETIME DEFAULT NULL,
  cancelado_em DATETIME DEFAULT NULL,
  KEY idx_solicitacao_status (status),
  KEY idx_solicitacao_secretaria_origem (secretaria_origem),
  KEY idx_solicitacao_secretaria_destino (secretaria_destino),
  KEY idx_solicitacao_solicitante (solicitante_usuario_id),
  CONSTRAINT solicitacoes_movimentacao_ibfk_1
    FOREIGN KEY (solicitante_usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS solicitacoes_movimentacao_itens (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  solicitacao_id INT NOT NULL,
  bem_id INT NOT NULL,
  patrimonio VARCHAR(100) NOT NULL,
  bem_descricao VARCHAR(255) NOT NULL,
  de_secretaria VARCHAR(255) DEFAULT NULL,
  de_departamento VARCHAR(255) DEFAULT NULL,
  de_sala VARCHAR(255) DEFAULT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_solicitacao_item_solicitacao (solicitacao_id),
  KEY idx_solicitacao_item_bem (bem_id),
  CONSTRAINT solicitacoes_movimentacao_itens_ibfk_1
    FOREIGN KEY (solicitacao_id) REFERENCES solicitacoes_movimentacao(id) ON DELETE CASCADE,
  CONSTRAINT solicitacoes_movimentacao_itens_ibfk_2
    FOREIGN KEY (bem_id) REFERENCES bens(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
