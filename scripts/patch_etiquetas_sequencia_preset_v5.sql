-- Patch incremental para sequencia manual, faixas livres e preset global da Zebra

ALTER TABLE etiquetas_provisorias_lotes
  ADD COLUMN IF NOT EXISTS origem_reserva ENUM('automatico', 'faixa_manual') NOT NULL DEFAULT 'automatico' AFTER quantidade;

CREATE TABLE IF NOT EXISTS etiquetas_provisorias_sequence_settings (
  ano VARCHAR(4) NOT NULL PRIMARY KEY,
  proximo_numero_manual INT DEFAULT NULL,
  origem_ajuste ENUM('manual', 'realinhamento_seguro') DEFAULT NULL,
  atualizado_por_usuario_id INT DEFAULT NULL,
  atualizado_por_nome VARCHAR(255) DEFAULT NULL,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

ALTER TABLE etiquetas_provisorias_sequence_settings
  ADD COLUMN IF NOT EXISTS origem_ajuste ENUM('manual', 'realinhamento_seguro') DEFAULT NULL AFTER proximo_numero_manual;

CREATE TABLE IF NOT EXISTS etiquetas_provisorias_faixas_livres (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ano VARCHAR(4) NOT NULL,
  seq_inicial INT NOT NULL,
  seq_final INT NOT NULL,
  quantidade_registrada INT NOT NULL,
  observacao TEXT DEFAULT NULL,
  criado_por_usuario_id INT DEFAULT NULL,
  criado_por_nome VARCHAR(255) DEFAULT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_faixa_livre_ano (ano),
  INDEX idx_faixa_livre_intervalo (ano, seq_inicial, seq_final)
);

CREATE TABLE IF NOT EXISTS etiquetas_provisorias_realinhamentos (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ano VARCHAR(4) NOT NULL,
  proximo_numero_aplicado INT NOT NULL,
  origem_resultado ENUM('reuso', 'realinhamento_seguro', 'sequencia_normal') NOT NULL,
  lacunas_detectadas INT NOT NULL DEFAULT 0,
  reutilizaveis_encontrados INT NOT NULL DEFAULT 0,
  criado_por_usuario_id INT DEFAULT NULL,
  criado_por_nome VARCHAR(255) DEFAULT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_realinhamento_ano (ano),
  INDEX idx_realinhamento_criado (criado_em)
);

CREATE TABLE IF NOT EXISTS etiquetas_print_settings (
  id INT NOT NULL PRIMARY KEY,
  offset_x_mm DECIMAL(8,2) NOT NULL DEFAULT 0,
  offset_y_mm DECIMAL(8,2) NOT NULL DEFAULT 1,
  offset_coluna_2_mm DECIMAL(8,2) NOT NULL DEFAULT 3,
  altura_extra_mm DECIMAL(8,2) NOT NULL DEFAULT 20,
  inner_padding_mm DECIMAL(8,2) NOT NULL DEFAULT 1.5,
  atualizado_por_usuario_id INT DEFAULT NULL,
  atualizado_por_nome VARCHAR(255) DEFAULT NULL,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO etiquetas_print_settings
  (id, offset_x_mm, offset_y_mm, offset_coluna_2_mm, altura_extra_mm, inner_padding_mm)
VALUES (1, 0, 1, 3, 20, 1.5)
ON DUPLICATE KEY UPDATE id = id;

CREATE TABLE IF NOT EXISTS etiquetas_layout_settings (
  preset_key VARCHAR(50) NOT NULL PRIMARY KEY,
  title VARCHAR(255) DEFAULT NULL,
  subtitle VARCHAR(255) DEFAULT NULL,
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
  atualizado_por_usuario_id INT DEFAULT NULL,
  atualizado_por_nome VARCHAR(255) DEFAULT NULL,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO etiquetas_layout_settings
  (preset_key, title, subtitle, show_description, show_emenda, show_location, show_footer, show_parent, qr_size_mm,
   offset_x_mm, offset_y_mm, offset_coluna_2_mm, altura_extra_mm, inner_padding_mm)
VALUES
  ('patrimonio_provisorio', '', '', 1, 1, 0, 1, 0, 16, 0, 1, 3, 20, 1.5),
  ('qr_cadastro', 'Identificacao de Ambiente', '', 0, 0, 0, 1, 1, 17, 0, 1, 3, 20, 1.5)
ON DUPLICATE KEY UPDATE preset_key = preset_key;

UPDATE etiquetas_layout_settings layout
JOIN etiquetas_print_settings legacy ON legacy.id = 1
   SET layout.offset_x_mm = legacy.offset_x_mm,
       layout.offset_y_mm = legacy.offset_y_mm,
       layout.offset_coluna_2_mm = legacy.offset_coluna_2_mm,
       layout.altura_extra_mm = legacy.altura_extra_mm,
       layout.inner_padding_mm = legacy.inner_padding_mm
 WHERE layout.preset_key = 'patrimonio_provisorio';
