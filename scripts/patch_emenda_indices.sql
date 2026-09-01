-- =============================================
-- Patch de Atualização: Emenda Parlamentar e Índices
-- Data: 2026-03-12
-- Descrição: Adiciona coluna 'emenda_parlamentar' e índices de performance
-- Seguro para rodar em banco de produção (não apaga dados)
-- =============================================

USE sispatrimonio;

-- 1. Adicionar coluna emenda_parlamentar se não existir
SET @dbname = DATABASE();
SET @tablename = "bens";
SET @columnname = "emenda_parlamentar";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  CONCAT("ALTER TABLE ", @tablename, " ADD ", @columnname, " VARCHAR(255) DEFAULT NULL AFTER nota_fiscal_url;")
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 2. Criar índices de performance (se não existirem)
-- O MariaDB/MySQL >= 10.5 suporta IF NOT EXISTS para CREATE INDEX, mas para compatibilidade
-- com versões antigas, vamos usar procedures armazenadas temporárias ou ignorar erros.

-- Índice para busca por emenda
SET @indexName = "idx_bens_emenda";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = @indexName)
  ) > 0,
  "SELECT 1",
  CONCAT("CREATE INDEX ", @indexName, " ON ", @tablename, "(", @columnname, ");")
));
PREPARE createIndex FROM @preparedStatement;
EXECUTE createIndex;
DEALLOCATE PREPARE createIndex;

-- Outros índices importantes (garantindo que existam)
-- idx_bens_patrimonio
SET @indexName = "idx_bens_patrimonio";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = @indexName)
  ) > 0,
  "SELECT 1",
  CONCAT("CREATE INDEX ", @indexName, " ON ", @tablename, "(patrimonio);")
));
PREPARE createIndex FROM @preparedStatement;
EXECUTE createIndex;
DEALLOCATE PREPARE createIndex;

-- idx_bens_status
SET @indexName = "idx_bens_status";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = @indexName)
  ) > 0,
  "SELECT 1",
  CONCAT("CREATE INDEX ", @indexName, " ON ", @tablename, "(status);")
));
PREPARE createIndex FROM @preparedStatement;
EXECUTE createIndex;
DEALLOCATE PREPARE createIndex;

-- idx_bens_secretaria
SET @indexName = "idx_bens_secretaria";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (index_name = @indexName)
  ) > 0,
  "SELECT 1",
  CONCAT("CREATE INDEX ", @indexName, " ON ", @tablename, "(localizacao_secretaria);")
));
PREPARE createIndex FROM @preparedStatement;
EXECUTE createIndex;
DEALLOCATE PREPARE createIndex;

SELECT "Atualizacao concluida com sucesso!" as Status;
