-- SIS Patrimônio: pré-requisitos do CRUD móvel de fornecedores.
-- Compatível com o MariaDB usado pelo projeto.
--
-- NÃO execute em produção sem backup e aprovação. Primeiro rode o SELECT de
-- pré-verificação abaixo em homologação. Se retornar linhas, resolva os
-- documentos repetidos antes de aplicar o ALTER TABLE. O ALTER do índice único
-- também falha sem apagar registros caso exista duplicidade.

-- Pré-verificação somente leitura: colisões após normalizar CPF/CNPJ para dígitos.
SELECT documento_normalizado, COUNT(*) AS quantidade, GROUP_CONCAT(id ORDER BY id) AS fornecedores
FROM (
  SELECT
    id,
    CASE
      WHEN CHAR_LENGTH(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '')) IN (11, 14)
      THEN REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '')
      ELSE NULL
    END AS documento_normalizado
  FROM fornecedores
) AS documentos
WHERE documento_normalizado IS NOT NULL
GROUP BY documento_normalizado
HAVING COUNT(*) > 1;

-- Execute apenas depois de revisar a pré-verificação.
-- Os novos campos são aditivos; cnpj_normalizado é derivado sem reescrever cnpj.
ALTER TABLE fornecedores
  ADD COLUMN IF NOT EXISTS nome_fantasia VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS razao_social VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS estado VARCHAR(2) NULL,
  ADD COLUMN IF NOT EXISTS cidade VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS cnpj_normalizado VARCHAR(14)
    GENERATED ALWAYS AS (
      CASE
        WHEN CHAR_LENGTH(REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '')) IN (11, 14)
        THEN REGEXP_REPLACE(COALESCE(cnpj, ''), '[^0-9]', '')
        ELSE NULL
      END
    ) PERSISTENT,
  ADD UNIQUE INDEX IF NOT EXISTS uq_fornecedores_cnpj_normalizado (cnpj_normalizado);

-- Validação pós-aplicação: a API móvel exige todas as colunas e o índice acima.
SHOW COLUMNS FROM fornecedores;
SHOW INDEX FROM fornecedores;
