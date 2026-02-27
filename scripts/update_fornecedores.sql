-- Script para adicionar tabela de fornecedores e coluna na tabela de bens
-- Importar no phpMyAdmin ou executar via linha de comando

-- 1. Criar tabela fornecedores
CREATE TABLE IF NOT EXISTS fornecedores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cnpj VARCHAR(20) DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  telefone VARCHAR(50) DEFAULT NULL,
  endereco TEXT DEFAULT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Adicionar coluna fornecedor na tabela bens
-- Verifica se a coluna já existe antes de adicionar (MariaDB/MySQL não tem IF NOT EXISTS para coluna nativo simples em ALTER TABLE, 
-- mas o comando abaixo funciona se a coluna não existir, ou falha sem estragar nada se já existir)
SET @dbname = DATABASE();
SET @tablename = "bens";
SET @columnname = "fornecedor";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE bens ADD COLUMN fornecedor VARCHAR(255) DEFAULT NULL"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
