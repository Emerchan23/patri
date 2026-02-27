CREATE TABLE IF NOT EXISTS grupos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE
);

-- Migrar grupos existentes da tabela bens para a tabela grupos
INSERT IGNORE INTO grupos (nome)
SELECT DISTINCT grupo FROM bens WHERE grupo IS NOT NULL AND grupo != '' AND grupo != 'Geral';

-- Inserir grupo padrão se não existir
INSERT IGNORE INTO grupos (nome) VALUES ('Geral');
