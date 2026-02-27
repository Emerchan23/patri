
-- Script para corrigir colunas faltantes no banco de dados
-- Execute este script no phpMyAdmin ou cliente MySQL

USE sispatrimonio;

-- 1. Adicionar coluna motivo_baixa na tabela bens (caso não exista)
SET @dbname = DATABASE();
SET @tablename = "bens";
SET @columnname = "motivo_baixa";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE bens ADD COLUMN motivo_baixa TEXT DEFAULT NULL AFTER status;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 2. Adicionar coluna tempo_garantia na tabela bens
SET @columnname = "tempo_garantia";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE bens ADD COLUMN tempo_garantia INT DEFAULT NULL AFTER motivo_baixa;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 3. Garantir que a coluna grupo existe
SET @columnname = "grupo";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE bens ADD COLUMN grupo VARCHAR(100) NOT NULL DEFAULT 'Geral' AFTER categoria_slug;"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 3. Garantir que a tabela grupos existe
CREATE TABLE IF NOT EXISTS grupos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Inserir grupo Geral se não existir
INSERT IGNORE INTO grupos (nome) VALUES ('Geral');

-- 5. Adicionar índice para tempo_garantia se necessário
-- (Opcional, mas bom para performance se for filtrar por garantia)
-- CREATE INDEX idx_bens_garantia ON bens(tempo_garantia);
