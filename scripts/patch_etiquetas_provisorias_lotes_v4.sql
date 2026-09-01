-- SisPatrimonio - Patch incremental de etiquetas provisórias e lotes
-- Data: 2026-05-13

USE sispatrimonio;

CREATE TABLE IF NOT EXISTS etiquetas_provisorias_lotes (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ano VARCHAR(4) NOT NULL,
  quantidade INT NOT NULL,
  faixa_inicial VARCHAR(50) NOT NULL,
  faixa_final VARCHAR(50) NOT NULL,
  status ENUM('reservado','parcialmente_usado','usado','cancelado') NOT NULL DEFAULT 'reservado',
  observacao TEXT NULL,
  emenda_parlamentar VARCHAR(255) NULL,
  criado_por_usuario_id INT NULL,
  criado_por_nome VARCHAR(255) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_lote_status (status),
  INDEX idx_lote_ano (ano)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE etiquetas_provisorias
  MODIFY COLUMN status ENUM('reservada','em_uso','usada','cancelada','disponivel_para_reuso','disponivel')
  NOT NULL DEFAULT 'reservada';

ALTER TABLE etiquetas_provisorias
  ADD COLUMN IF NOT EXISTS lote_id INT NULL AFTER bem_id,
  ADD COLUMN IF NOT EXISTS observacao TEXT NULL AFTER lote_id,
  ADD COLUMN IF NOT EXISTS emenda_parlamentar VARCHAR(255) NULL AFTER observacao,
  ADD COLUMN IF NOT EXISTS reservado_por_usuario_id INT NULL AFTER emenda_parlamentar,
  ADD COLUMN IF NOT EXISTS reservado_por_nome VARCHAR(255) NULL AFTER reservado_por_usuario_id,
  ADD COLUMN IF NOT EXISTS cancelado_em DATETIME NULL AFTER reservado_por_nome,
  ADD COLUMN IF NOT EXISTS usado_em DATETIME NULL AFTER cancelado_em;

CREATE INDEX idx_etiqueta_status ON etiquetas_provisorias (status);
CREATE INDEX idx_etiqueta_lote ON etiquetas_provisorias (lote_id);
