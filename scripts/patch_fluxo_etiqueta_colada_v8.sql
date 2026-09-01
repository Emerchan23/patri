ALTER TABLE bens
  ADD COLUMN IF NOT EXISTS etiqueta_status ENUM('pendente','enviada','colada') DEFAULT NULL AFTER patrimonio_tipo,
  ADD COLUMN IF NOT EXISTS etiqueta_enviada_em DATETIME DEFAULT NULL AFTER etiqueta_status,
  ADD COLUMN IF NOT EXISTS etiqueta_enviada_por VARCHAR(255) DEFAULT NULL AFTER etiqueta_enviada_em,
  ADD COLUMN IF NOT EXISTS etiqueta_colada_em DATETIME DEFAULT NULL AFTER etiqueta_enviada_por,
  ADD COLUMN IF NOT EXISTS etiqueta_colada_por VARCHAR(255) DEFAULT NULL AFTER etiqueta_colada_em;

SET @idx_exists := (
  SELECT COUNT(*)
    FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'bens'
     AND index_name = 'idx_bens_etiqueta_status'
);
SET @idx_sql := IF(@idx_exists = 0, 'CREATE INDEX idx_bens_etiqueta_status ON bens (etiqueta_status)', 'SELECT 1');
PREPARE stmt FROM @idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
