-- Atualizacao do SisPatrimonio para Modulo de Alienacao
-- Executar este script para adicionar as tabelas necessarias

USE sispatrimonio;

-- 1. Tabela Principal de Alienacoes
CREATE TABLE IF NOT EXISTS alienacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo ENUM('venda', 'leilao', 'doacao', 'permuta', 'descarte') NOT NULL,
  numero_processo VARCHAR(50) NOT NULL COMMENT 'Numero do Processo Administrativo',
  numero_edital VARCHAR(50) DEFAULT NULL COMMENT 'Numero do Edital (apenas para leilao)',
  data_abertura DATE NOT NULL,
  data_conclusao DATE DEFAULT NULL,
  status ENUM('aberto', 'em_avaliacao', 'concluido', 'cancelado') NOT NULL DEFAULT 'aberto',
  
  -- Destinatario (Comprador ou Donatario)
  destinatario_nome VARCHAR(200) DEFAULT NULL,
  destinatario_documento VARCHAR(20) DEFAULT NULL COMMENT 'CPF ou CNPJ',
  destinatario_endereco VARCHAR(300) DEFAULT NULL,
  
  -- Valores Consolidados
  valor_total_itens INT DEFAULT 0,
  valor_total_avaliacao DECIMAL(15,2) DEFAULT 0.00,
  valor_total_alienado DECIMAL(15,2) DEFAULT 0.00,
  
  observacoes TEXT DEFAULT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  criado_por INT DEFAULT NULL,
  FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Itens da Alienacao (Bens vinculados)
CREATE TABLE IF NOT EXISTS alienacao_itens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  alienacao_id INT NOT NULL,
  bem_id INT NOT NULL,
  
  -- Valores do Bem no momento da inclusao (Snapshot)
  valor_aquisicao DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  valor_contabil DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  
  -- Valores do Processo
  valor_avaliacao DECIMAL(15,2) DEFAULT 0.00 COMMENT 'Valor de Mercado estipulado pela comissao',
  valor_alienado DECIMAL(15,2) DEFAULT 0.00 COMMENT 'Valor final de venda/arremate',
  
  status_item ENUM('pendente', 'alienado', 'removido') DEFAULT 'pendente',
  
  FOREIGN KEY (alienacao_id) REFERENCES alienacoes(id) ON DELETE CASCADE,
  FOREIGN KEY (bem_id) REFERENCES bens(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Comissao de Avaliacao
CREATE TABLE IF NOT EXISTS alienacao_comissao (
  id INT AUTO_INCREMENT PRIMARY KEY,
  alienacao_id INT NOT NULL,
  nome VARCHAR(200) NOT NULL,
  cargo VARCHAR(200) NOT NULL,
  cpf VARCHAR(20) DEFAULT NULL,
  tipo_membro ENUM('presidente', 'membro', 'secretario', 'leiloeiro') DEFAULT 'membro',
  FOREIGN KEY (alienacao_id) REFERENCES alienacoes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indices para performance
CREATE INDEX idx_alienacoes_status ON alienacoes(status);
CREATE INDEX idx_alienacoes_tipo ON alienacoes(tipo);
CREATE INDEX idx_alienacao_itens_bem ON alienacao_itens(bem_id);
