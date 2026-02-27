-- =============================================
-- SisPatrimonio - Script Completo v2 para MariaDB
-- Atualizado com todos os módulos (Alienação, Grupos, Motivo Baixa, Acesso App, Servidores)
-- Importar no phpMyAdmin do XAMPP ou via linha de comando
-- =============================================

CREATE DATABASE IF NOT EXISTS sispatrimonio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sispatrimonio;

-- =============================================
-- TABELAS PRINCIPAIS
-- =============================================

-- 1. Usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  email VARCHAR(200) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  cargo VARCHAR(200) NOT NULL,
  role ENUM('administrador','gestor','assistente') NOT NULL DEFAULT 'assistente',
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  acesso_app TINYINT(1) NOT NULL DEFAULT 0, -- Adicionado
  avatar VARCHAR(10) NOT NULL DEFAULT '',
  unidade_secretaria VARCHAR(200) DEFAULT NULL,
  unidade_departamento VARCHAR(200) DEFAULT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_acesso DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Secretarias gerenciadas pelo gestor (N:N)
CREATE TABLE IF NOT EXISTS secretarias_gerenciadas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  secretaria VARCHAR(200) NOT NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Categorias de bens
CREATE TABLE IF NOT EXISTS categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  descricao TEXT DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Marcas
CREATE TABLE IF NOT EXISTS marcas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(200) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Grupos (Novo)
CREATE TABLE IF NOT EXISTS grupos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5.1 Fornecedores (Novo)
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

-- 6. Secretarias
CREATE TABLE IF NOT EXISTS secretarias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(200) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Departamentos
CREATE TABLE IF NOT EXISTS departamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  secretaria_id INT NOT NULL,
  nome VARCHAR(200) NOT NULL,
  FOREIGN KEY (secretaria_id) REFERENCES secretarias(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Salas
CREATE TABLE IF NOT EXISTS salas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  departamento_id INT NOT NULL,
  nome VARCHAR(200) NOT NULL,
  FOREIGN KEY (departamento_id) REFERENCES departamentos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Bens patrimoniais (inclui veiculos)
CREATE TABLE IF NOT EXISTS bens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patrimonio VARCHAR(50) NOT NULL UNIQUE,
  patrimonio_provisorio VARCHAR(50) DEFAULT NULL,
  patrimonio_tipo ENUM('definitivo','provisorio') NOT NULL DEFAULT 'provisorio',
  descricao VARCHAR(500) NOT NULL,
  categoria_slug VARCHAR(200) NOT NULL,
  grupo VARCHAR(100) NOT NULL DEFAULT 'Geral',
  localizacao_secretaria VARCHAR(200) NOT NULL,
  localizacao_departamento VARCHAR(200) NOT NULL,
  localizacao_sala VARCHAR(200) NOT NULL,
  responsavel_nome VARCHAR(200) NOT NULL,
  responsavel_cargo VARCHAR(200) NOT NULL,
  data_aquisicao DATE NOT NULL,
  valor DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  status ENUM('ativo','em_manutencao','baixado','transferido','emprestado') NOT NULL DEFAULT 'ativo',
  motivo_baixa TEXT DEFAULT NULL, -- Adicionado
  tempo_garantia INT DEFAULT NULL, -- Adicionado (meses)
  fornecedor VARCHAR(255) DEFAULT NULL, -- Adicionado
  marca VARCHAR(200) DEFAULT NULL,
  modelo VARCHAR(200) DEFAULT NULL,
  numero_serie VARCHAR(200) DEFAULT NULL,
  estado_conservacao VARCHAR(50) DEFAULT NULL,
  observacoes TEXT DEFAULT NULL,
  imagem LONGTEXT DEFAULT NULL,
  -- Campos especificos de veiculo
  placa VARCHAR(20) DEFAULT NULL,
  ano INT DEFAULT NULL,
  km_atual INT DEFAULT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Movimentacoes
CREATE TABLE IF NOT EXISTS movimentacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bem_id INT DEFAULT NULL,
  bem_descricao VARCHAR(500) NOT NULL,
  patrimonio VARCHAR(50) NOT NULL,
  de_secretaria VARCHAR(200) NOT NULL,
  de_departamento VARCHAR(200) NOT NULL,
  de_sala VARCHAR(200) NOT NULL,
  para_secretaria VARCHAR(200) NOT NULL,
  para_departamento VARCHAR(200) NOT NULL,
  para_sala VARCHAR(200) NOT NULL,
  responsavel VARCHAR(200) NOT NULL,
  data DATE NOT NULL,
  motivo TEXT NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bem_id) REFERENCES bens(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Emprestimos
CREATE TABLE IF NOT EXISTS emprestimos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bem_id INT DEFAULT NULL,
  bem_descricao VARCHAR(500) NOT NULL,
  patrimonio VARCHAR(50) NOT NULL,
  origem_secretaria VARCHAR(200) NOT NULL,
  origem_departamento VARCHAR(200) NOT NULL,
  origem_sala VARCHAR(200) NOT NULL,
  destino_secretaria VARCHAR(200) NOT NULL,
  destino_departamento VARCHAR(200) NOT NULL,
  destino_sala VARCHAR(200) NOT NULL,
  responsavel_emprestimo VARCHAR(200) NOT NULL,
  responsavel_recebimento VARCHAR(200) NOT NULL,
  data_emprestimo DATE NOT NULL,
  data_prevista_devolucao DATE NOT NULL,
  data_devolucao DATE DEFAULT NULL,
  motivo TEXT NOT NULL,
  observacoes TEXT DEFAULT NULL,
  status ENUM('ativo','devolvido','atrasado') NOT NULL DEFAULT 'ativo',
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bem_id) REFERENCES bens(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Logs de auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  acao VARCHAR(50) NOT NULL,
  descricao TEXT NOT NULL,
  detalhes TEXT DEFAULT NULL,
  usuario_id INT DEFAULT NULL,
  usuario_nome VARCHAR(200) NOT NULL,
  usuario_role VARCHAR(50) NOT NULL,
  entidade_tipo VARCHAR(50) DEFAULT NULL,
  entidade_id VARCHAR(50) DEFAULT NULL,
  entidade_descricao VARCHAR(500) DEFAULT NULL,
  ip VARCHAR(50) DEFAULT NULL,
  data_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dados_anteriores JSON DEFAULT NULL,
  dados_novos JSON DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Notificacoes
CREATE TABLE IF NOT EXISTS notificacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT DEFAULT NULL,
  role_destino VARCHAR(50) DEFAULT NULL,
  titulo VARCHAR(300) NOT NULL,
  mensagem TEXT NOT NULL,
  tipo ENUM('info','warning','success','error') NOT NULL DEFAULT 'info',
  lida TINYINT(1) NOT NULL DEFAULT 0,
  link VARCHAR(500) DEFAULT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Configuracoes PDF
CREATE TABLE IF NOT EXISTS pdf_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome_orgao VARCHAR(300) NOT NULL,
  subtitulo VARCHAR(500) NOT NULL,
  endereco VARCHAR(500) NOT NULL,
  telefone VARCHAR(50) NOT NULL,
  email VARCHAR(200) NOT NULL,
  site VARCHAR(200) NOT NULL,
  cnpj VARCHAR(30) NOT NULL,
  logo_url LONGTEXT DEFAULT NULL,
  rodape VARCHAR(500) NOT NULL,
  mostrar_logo TINYINT(1) NOT NULL DEFAULT 1,
  mostrar_data_hora TINYINT(1) NOT NULL DEFAULT 1,
  mostrar_numero_pagina TINYINT(1) NOT NULL DEFAULT 1,
  mostrar_assinatura TINYINT(1) NOT NULL DEFAULT 1,
  assinatura_texto VARCHAR(300) NOT NULL,
  assinatura_cargo VARCHAR(300) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Sessoes (para tracking)
CREATE TABLE IF NOT EXISTS sessoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  ip VARCHAR(50) DEFAULT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_em DATETIME NOT NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Etiquetas Provisorias
CREATE TABLE IF NOT EXISTS etiquetas_provisorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  gerado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('disponivel', 'em_uso') NOT NULL DEFAULT 'disponivel',
  bem_id INT DEFAULT NULL,
  FOREIGN KEY (bem_id) REFERENCES bens(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. Servidores (Novo)
CREATE TABLE IF NOT EXISTS servidores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cargo VARCHAR(255) NOT NULL,
  cpf VARCHAR(20) DEFAULT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- MÓDULO DE ALIENAÇÃO (Novo)
-- =============================================

-- 18. Tabela Principal de Alienacoes
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

-- 19. Itens da Alienacao (Bens vinculados)
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

-- 20. Comissao de Avaliacao
CREATE TABLE IF NOT EXISTS alienacao_comissao (
  id INT AUTO_INCREMENT PRIMARY KEY,
  alienacao_id INT NOT NULL,
  nome VARCHAR(200) NOT NULL,
  cargo VARCHAR(200) NOT NULL,
  cpf VARCHAR(20) DEFAULT NULL,
  tipo_membro ENUM('presidente', 'membro', 'secretario', 'leiloeiro') DEFAULT 'membro',
  FOREIGN KEY (alienacao_id) REFERENCES alienacoes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21. Configuracoes do Sistema (Novo)
CREATE TABLE IF NOT EXISTS system_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  theme_color VARCHAR(50) DEFAULT 'blue',
  sidebar_color VARCHAR(50) DEFAULT 'dark',
  integration_patrimonio_url VARCHAR(255) DEFAULT NULL,
  integration_patrimonio_key VARCHAR(255) DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- TABELA DE CONFIGURAÇÕES DE API EXTERNA (NOVO)
-- =============================================
CREATE TABLE IF NOT EXISTS api_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL COMMENT 'Nome do sistema externo (ex: Manutenção)',
    chave VARCHAR(255) NOT NULL UNIQUE COMMENT 'Chave de API para autenticação',
    ativo TINYINT(1) DEFAULT 1,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed API Key
INSERT INTO api_keys (nome, chave) VALUES ('Sistema Manutencao', 'sispatrimonio-manutencao-secret-key-2025');

-- =============================================
-- INDICES
-- =============================================
CREATE INDEX idx_bens_patrimonio ON bens(patrimonio);
CREATE INDEX idx_bens_categoria ON bens(categoria_slug);
CREATE INDEX idx_bens_grupo ON bens(grupo);
CREATE INDEX idx_bens_status ON bens(status);
CREATE INDEX idx_bens_patrimonio_tipo ON bens(patrimonio_tipo);
CREATE INDEX idx_bens_secretaria ON bens(localizacao_secretaria);
CREATE INDEX idx_movimentacoes_bem ON movimentacoes(bem_id);
CREATE INDEX idx_movimentacoes_data ON movimentacoes(data);
CREATE INDEX idx_emprestimos_bem ON emprestimos(bem_id);
CREATE INDEX idx_emprestimos_status ON emprestimos(status);
CREATE INDEX idx_audit_logs_acao ON audit_logs(acao);
CREATE INDEX idx_audit_logs_data ON audit_logs(data_hora);
CREATE INDEX idx_audit_logs_usuario ON audit_logs(usuario_id);
CREATE INDEX idx_notificacoes_usuario ON notificacoes(usuario_id);
CREATE INDEX idx_notificacoes_role ON notificacoes(role_destino);
CREATE INDEX idx_notificacoes_lida ON notificacoes(lida);
CREATE INDEX idx_sessoes_usuario ON sessoes(usuario_id);
CREATE INDEX idx_sessoes_expira ON sessoes(expira_em);
-- Indices Alienacao
CREATE INDEX idx_alienacoes_status ON alienacoes(status);
CREATE INDEX idx_alienacoes_tipo ON alienacoes(tipo);
CREATE INDEX idx_alienacao_itens_bem ON alienacao_itens(bem_id);

-- =============================================
-- DADOS SEED (Padrão)
-- =============================================

-- Grupos
INSERT INTO grupos (nome) VALUES ('Geral');

-- Usuarios (senhas hashadas com bcrypt)
-- admin123 -> $2a$12$yudRm1XiaYfgxlMopum6f.Te6p5XKKobpHAfjHS2jrnncA8AII7W2

-- USUARIO PADRAO PARA PRODUCAO (Outros usuarios demo comentados)
INSERT INTO usuarios (id, nome, email, senha_hash, cargo, role, ativo, acesso_app, avatar, unidade_secretaria, unidade_departamento, criado_em, ultimo_acesso) VALUES
(1, 'Roberto Gomes', 'admin@prefeitura.gov.br', '$2a$12$yudRm1XiaYfgxlMopum6f.Te6p5XKKobpHAfjHS2jrnncA8AII7W2', 'Diretor de TI', 'administrador', 1, 1, 'RG', NULL, NULL, '2023-01-15 00:00:00', '2025-02-10 00:00:00');

-- Usuarios Demo (Desativados para Producao - Descomente se necessario para testes)
/*
INSERT INTO usuarios (id, nome, email, senha_hash, cargo, role, ativo, acesso_app, avatar, unidade_secretaria, unidade_departamento, criado_em, ultimo_acesso) VALUES
(2, 'Claudia Ferreira', 'gestor@prefeitura.gov.br', '$2a$12$Wl4HTfbv935rO45bv5002.BaYTAA3rQnyY7YqzCHggCklfXQ.NOVG', 'Chefe do Patrimonio', 'gestor', 1, 0, 'CF', NULL, NULL, '2023-03-20 00:00:00', '2025-02-09 00:00:00'),
(3, 'Maria Silva', 'maria@prefeitura.gov.br', '$2a$12$90BmhdeTyIIX0M5oCtyuYO8901NL6EtUa0.cWwORS9el1MgDgSL8u', 'Coordenadora de RH', 'assistente', 1, 0, 'MS', 'Secretaria de Administracao', 'Recursos Humanos', '2023-06-10 00:00:00', '2025-02-08 00:00:00'),
(4, 'Joao Santos', 'joao@prefeitura.gov.br', '$2a$12$tSsYXLhMquUMppwArWejpO7J9.MHQUGfk.lCeoNSVxlLSP6InLSBK', 'Coordenador Pedagogico', 'assistente', 1, 0, 'JS', 'Secretaria de Educacao', 'Coordenacao Pedagogica', '2023-08-05 00:00:00', '2025-02-07 00:00:00'),
(5, 'Carlos Souza', 'carlos@prefeitura.gov.br', '$2a$12$w9m7F3ltn5xLzFyKovcqjebSrtaKQEPl0S5X897ai/nps4i5JHkVu', 'Gerente de Unidade', 'assistente', 1, 0, 'CS', 'Secretaria de Saude', 'Atencao Basica', '2024-01-12 00:00:00', '2025-02-06 00:00:00'),
(6, 'Ana Oliveira', 'ana@prefeitura.gov.br', '$2a$12$OmKk3W18rvZizWOqkCH.VeD95AHcFurNrc4k1NKCfbnrhARDWPyge', 'Contadora Chefe', 'assistente', 0, 0, 'AO', 'Secretaria de Financas', 'Contabilidade', '2024-03-22 00:00:00', '2025-01-15 00:00:00');
*/

-- Secretarias gerenciadas (Comentado pois depende de usuarios demo)
/*
INSERT INTO secretarias_gerenciadas (usuario_id, secretaria) VALUES
(2, 'Secretaria de Administracao'),
(2, 'Secretaria de Educacao'),
(2, 'Secretaria de Saude'),
(2, 'Secretaria de Obras'),
(2, 'Secretaria de Financas');
*/

-- Categorias
INSERT INTO categorias (nome, slug, descricao) VALUES
('Informatica', 'informatica', 'Computadores, impressoras, scanners e perifericos'),
('Movel', 'movel', 'Mesas, cadeiras, armarios e estantes'),
('Equipamento', 'equipamento', 'Ar condicionado, ferramentas e maquinarios'),
('Eletronico', 'eletronico', 'Projetores, TVs e equipamentos eletronicos'),
('Veiculo', 'veiculo', 'Carros, motos e veiculos em geral');

-- Marcas
INSERT INTO marcas (nome) VALUES
('Dell'), ('HP'), ('Lenovo'), ('Samsung'), ('Epson'),
('Fujitsu'), ('SMS'), ('Planalto'), ('Flexform'), ('Pandin'),
('Fiat'), ('Volkswagen'), ('Renault'), ('Iveco');

-- Secretarias
INSERT INTO secretarias (id, nome) VALUES
(1, 'Secretaria de Administracao'),
(2, 'Secretaria de Educacao'),
(3, 'Secretaria de Saude'),
(4, 'Secretaria de Obras'),
(5, 'Secretaria de Financas');

-- Departamentos
INSERT INTO departamentos (id, secretaria_id, nome) VALUES
(1, 1, 'Recursos Humanos'),
(2, 1, 'Compras e Licitacoes'),
(3, 1, 'Patrimonio'),
(4, 2, 'Coordenacao Pedagogica'),
(5, 2, 'Transporte Escolar'),
(6, 2, 'Merenda Escolar'),
(7, 3, 'Atencao Basica'),
(8, 3, 'Vigilancia Sanitaria'),
(9, 3, 'Farmacia Municipal'),
(10, 4, 'Engenharia'),
(11, 4, 'Fiscalizacao'),
(12, 4, 'Almoxarifado Central'),
(13, 5, 'Contabilidade'),
(14, 5, 'Tesouraria'),
(15, 5, 'Tributacao');

-- Salas
INSERT INTO salas (departamento_id, nome) VALUES
(1, 'Sala 101'), (1, 'Sala 102'), (1, 'Sala 103'),
(2, 'Sala 201'), (2, 'Sala 202'),
(3, 'Sala 301'), (3, 'Sala 302'), (3, 'Deposito'),
(4, 'Sala 101'), (4, 'Sala 102'),
(5, 'Garagem'), (5, 'Sala 201'),
(6, 'Cozinha'), (6, 'Almoxarifado'),
(7, 'Sala 101'), (7, 'Sala 102'), (7, 'Sala 103'),
(8, 'Sala 201'), (8, 'Sala 202'),
(9, 'Estoque'), (9, 'Atendimento'),
(10, 'Sala 101'), (10, 'Sala 102'),
(11, 'Sala 201'),
(12, 'Galpao A'), (12, 'Galpao B'),
(13, 'Sala 101'), (13, 'Sala 102'),
(14, 'Sala 201'),
(15, 'Sala 301'), (15, 'Sala 302');

-- Bens patrimoniais
INSERT INTO bens (id, patrimonio, patrimonio_provisorio, patrimonio_tipo, descricao, categoria_slug, localizacao_secretaria, localizacao_departamento, localizacao_sala, responsavel_nome, responsavel_cargo, data_aquisicao, valor, status, marca, modelo, numero_serie, estado_conservacao) VALUES
(1, 'PAT-2024-00142', NULL, 'definitivo', 'Computador Dell OptiPlex 7010', 'informatica', 'Secretaria de Administracao', 'Recursos Humanos', 'Sala 101', 'Maria Silva', 'Coordenadora de RH', '2024-03-15', 4500.00, 'ativo', 'Dell', 'OptiPlex 7010', 'SN-DELL-78912', 'Bom'),
(2, 'PROV-2025-00034', 'PROV-2025-00034', 'provisorio', 'Impressora Multifuncional HP LaserJet Pro', 'informatica', 'Secretaria de Educacao', 'Coordenacao Pedagogica', 'Sala 101', 'Joao Santos', 'Coordenador Pedagogico', '2025-01-20', 3200.00, 'ativo', 'HP', 'LaserJet Pro M428fdw', 'SN-HP-45678', 'Novo'),
(3, 'PAT-2023-00089', NULL, 'definitivo', 'Mesa de Escritorio em L', 'movel', 'Secretaria de Financas', 'Contabilidade', 'Sala 101', 'Ana Oliveira', 'Contadora Chefe', '2023-06-10', 1200.00, 'ativo', 'Planalto', 'Executiva Pro', NULL, 'Bom'),
(4, 'PAT-2022-00567', NULL, 'definitivo', 'Ar Condicionado Split 12.000 BTUs', 'equipamento', 'Secretaria de Saude', 'Atencao Basica', 'Sala 102', 'Carlos Souza', 'Gerente de Unidade', '2022-11-05', 2800.00, 'em_manutencao', 'Samsung', 'Wind-Free 12K', 'SN-SAM-33210', 'Regular'),
(5, 'PROV-2025-00071', 'PROV-2025-00071', 'provisorio', 'Notebook Lenovo ThinkPad', 'informatica', 'Secretaria de Obras', 'Engenharia', 'Sala 101', 'Pedro Lima', 'Engenheiro Civil', '2025-02-01', 6500.00, 'ativo', 'Lenovo', 'ThinkPad T14', 'SN-LEN-99012', 'Novo'),
(6, 'PAT-2021-00234', NULL, 'definitivo', 'Cadeira Giratoria Presidente', 'movel', 'Secretaria de Administracao', 'Compras e Licitacoes', 'Sala 201', 'Lucia Mendes', 'Diretora de Compras', '2021-08-22', 950.00, 'ativo', 'Flexform', 'Presidente Plus', NULL, 'Regular'),
(7, 'PAT-2024-00321', NULL, 'definitivo', 'Projetor Epson PowerLite', 'eletronico', 'Secretaria de Educacao', 'Coordenacao Pedagogica', 'Sala 102', 'Ricardo Alves', 'Tecnico Pedagogico', '2024-05-12', 3800.00, 'baixado', 'Epson', 'PowerLite X49', 'SN-EPS-67801', 'Inoperante'),
(8, 'PROV-2025-00098', 'PROV-2025-00098', 'provisorio', 'Scanner de Documentos Fujitsu', 'informatica', 'Secretaria de Financas', 'Tributacao', 'Sala 301', 'Fernanda Costa', 'Fiscal Tributaria', '2025-01-28', 4100.00, 'ativo', 'Fujitsu', 'ScanSnap iX1600', 'SN-FUJ-12390', 'Novo'),
(9, 'PAT-2023-00445', NULL, 'definitivo', 'Armario de Aco 4 Portas', 'movel', 'Secretaria de Saude', 'Farmacia Municipal', 'Estoque', 'Dr. Paulo Vieira', 'Farmaceutico Responsavel', '2023-09-18', 780.00, 'ativo', 'Pandin', 'Standard 4P', NULL, 'Bom'),
(10, 'PAT-2024-00178', NULL, 'definitivo', 'Estabilizador SMS 1000VA', 'eletronico', 'Secretaria de Administracao', 'Patrimonio', 'Sala 301', 'Roberto Gomes', 'Chefe do Patrimonio', '2024-02-28', 320.00, 'ativo', 'SMS', 'Revolution Speed 1000VA', 'SN-SMS-55601', 'Bom');

-- Veiculos
INSERT INTO bens (id, patrimonio, patrimonio_provisorio, patrimonio_tipo, descricao, categoria_slug, localizacao_secretaria, localizacao_departamento, localizacao_sala, responsavel_nome, responsavel_cargo, data_aquisicao, valor, status, marca, modelo, estado_conservacao, placa, ano, km_atual) VALUES
(11, 'PAT-2023-V001', NULL, 'definitivo', 'Fiat Strada Endurance', 'veiculo', 'Secretaria de Obras', 'Fiscalizacao', 'Garagem', 'Marcos Silva', 'Fiscal de Obras', '2023-04-10', 95000.00, 'ativo', 'Fiat', 'Strada Endurance 1.4', 'Bom', 'ABC-1D23', 2023, 42500),
(12, 'PAT-2024-V002', NULL, 'definitivo', 'VW Saveiro Robust', 'veiculo', 'Secretaria de Saude', 'Vigilancia Sanitaria', 'Garagem', 'Sandra Reis', 'Agente Sanitario', '2024-01-15', 88000.00, 'ativo', 'Volkswagen', 'Saveiro Robust 1.6', 'Bom', 'DEF-4G56', 2024, 18300),
(13, 'PROV-2025-V003', 'PROV-2025-V003', 'provisorio', 'Renault Duster Zen', 'veiculo', 'Secretaria de Administracao', 'Recursos Humanos', 'Garagem', 'Felipe Cardoso', 'Motorista Oficial', '2025-01-05', 115000.00, 'ativo', 'Renault', 'Duster Zen 1.6', 'Novo', 'GHI-7J89', 2025, 3200),
(14, 'PAT-2022-V004', NULL, 'definitivo', 'Onibus Escolar Iveco City Class', 'veiculo', 'Secretaria de Educacao', 'Transporte Escolar', 'Garagem', 'Antonio Pereira', 'Coordenador de Transporte', '2022-02-20', 380000.00, 'em_manutencao', 'Iveco', 'City Class 70C17', 'Regular', 'JKL-0M12', 2022, 89700);

-- Movimentacoes
INSERT INTO movimentacoes (id, bem_id, bem_descricao, patrimonio, de_secretaria, de_departamento, de_sala, para_secretaria, para_departamento, para_sala, responsavel, data, motivo) VALUES
(1, 1, 'Computador Dell OptiPlex 7010', 'PAT-2024-00142', 'Secretaria de Financas', 'Tesouraria', 'Sala 201', 'Secretaria de Administracao', 'Recursos Humanos', 'Sala 101', 'Roberto Gomes', '2025-01-15', 'Realocacao por demanda do setor'),
(2, 4, 'Ar Condicionado Split 12.000 BTUs', 'PAT-2022-00567', 'Secretaria de Saude', 'Atencao Basica', 'Sala 101', 'Secretaria de Saude', 'Atencao Basica', 'Sala 102', 'Carlos Souza', '2025-01-10', 'Troca de sala por reforma'),
(3, 3, 'Mesa de Escritorio em L', 'PAT-2023-00089', 'Secretaria de Administracao', 'Compras e Licitacoes', 'Sala 201', 'Secretaria de Financas', 'Contabilidade', 'Sala 101', 'Ana Oliveira', '2024-12-20', 'Transferencia definitiva para setor de contabilidade'),
(4, 7, 'Projetor Epson PowerLite', 'PAT-2024-00321', 'Secretaria de Administracao', 'Patrimonio', 'Sala 301', 'Secretaria de Educacao', 'Coordenacao Pedagogica', 'Sala 102', 'Ricardo Alves', '2024-11-05', 'Emprestimo para evento pedagogico'),
(5, 6, 'Cadeira Giratoria Presidente', 'PAT-2021-00234', 'Secretaria de Administracao', 'Recursos Humanos', 'Sala 103', 'Secretaria de Administracao', 'Compras e Licitacoes', 'Sala 201', 'Lucia Mendes', '2024-10-18', 'Reposicao de mobiliario'),
(6, 10, 'Estabilizador SMS 1000VA', 'PAT-2024-00178', 'Secretaria de Obras', 'Engenharia', 'Sala 102', 'Secretaria de Administracao', 'Patrimonio', 'Sala 301', 'Roberto Gomes', '2024-09-30', 'Devolvido apos uso temporario');

-- Emprestimos
INSERT INTO emprestimos (id, bem_id, bem_descricao, patrimonio, origem_secretaria, origem_departamento, origem_sala, destino_secretaria, destino_departamento, destino_sala, responsavel_emprestimo, responsavel_recebimento, data_emprestimo, data_prevista_devolucao, data_devolucao, motivo, observacoes, status) VALUES
(1, 5, 'Notebook Lenovo ThinkPad', 'PROV-2025-00071', 'Secretaria de Obras', 'Engenharia', 'Sala 101', 'Secretaria de Administracao', 'Recursos Humanos', 'Sala 102', 'Pedro Lima', 'Maria Silva', '2025-02-01', '2025-03-01', NULL, 'Necessidade temporaria para projeto de RH', 'Devolver com carregador original', 'ativo'),
(2, 8, 'Scanner de Documentos Fujitsu', 'PROV-2025-00098', 'Secretaria de Financas', 'Tributacao', 'Sala 301', 'Secretaria de Saude', 'Atencao Basica', 'Sala 101', 'Fernanda Costa', 'Carlos Souza', '2025-01-15', '2025-02-05', NULL, 'Digitalizacao de prontuarios antigos', NULL, 'atrasado'),
(3, 10, 'Estabilizador SMS 1000VA', 'PAT-2024-00178', 'Secretaria de Administracao', 'Patrimonio', 'Sala 301', 'Secretaria de Educacao', 'Coordenacao Pedagogica', 'Sala 101', 'Roberto Gomes', 'Joao Santos', '2025-01-10', '2025-01-25', '2025-01-24', 'Protecao temporaria para equipamento de apresentacao', NULL, 'devolvido'),
(4, 6, 'Cadeira Giratoria Presidente', 'PAT-2021-00234', 'Secretaria de Administracao', 'Compras e Licitacoes', 'Sala 201', 'Secretaria de Obras', 'Engenharia', 'Sala 102', 'Lucia Mendes', 'Pedro Lima', '2024-12-15', '2025-01-15', '2025-01-10', 'Reposicao enquanto mobiliario novo nao chega', NULL, 'devolvido');

-- Logs de Auditoria (Comentado pois refere a usuarios demo)
/*
INSERT INTO audit_logs (acao, descricao, detalhes, usuario_id, usuario_nome, usuario_role, entidade_tipo, entidade_id, entidade_descricao, ip, data_hora, dados_anteriores, dados_novos) VALUES
('login', 'Login realizado no sistema', NULL, 1, 'Roberto Gomes', 'administrador', NULL, NULL, NULL, '192.168.1.100', '2025-02-10 08:15:00', NULL, NULL),
('cadastro', 'Novo bem cadastrado: Computador Dell OptiPlex 7010', 'Cadastro individual com patrimonio provisorio PROV-2025-00142', 3, 'Maria Silva', 'assistente', 'bem', '1', 'Computador Dell OptiPlex 7010', NULL, '2025-02-10 09:30:00', NULL, '{"patrimonio":"PROV-2025-00142","categoria":"informatica","valor":4500}'),
('entrada_nf', 'Entrada em lote por Nota Fiscal NF-2025-001234', '5 itens importados: 3x Ar Condicionado Split, 2x Mesa Escritorio', 2, 'Claudia Ferreira', 'gestor', 'bem', 'nf-batch-001', 'NF-2025-001234', NULL, '2025-02-09 14:20:00', NULL, '{"totalItens":5,"valorTotal":18600}'),
('transferencia', 'Transferencia: Computador Dell OptiPlex - Tesouraria para RH', 'Motivo: Realocacao por demanda do setor', 1, 'Roberto Gomes', 'administrador', 'movimentacao', '1', 'Computador Dell OptiPlex 7010', NULL, '2025-02-09 11:45:00', '{"departamento":"Tesouraria","sala":"Sala 201"}', '{"departamento":"Recursos Humanos","sala":"Sala 101"}'),
('patrimonio_definitivo', 'Patrimonio definitivo atribuido: Impressora HP LaserJet Pro', 'Provisorio PROV-2025-00034 convertido para PAT-2025-00034', 2, 'Claudia Ferreira', 'gestor', 'bem', '2', 'Impressora HP LaserJet Pro', NULL, '2025-02-08 16:10:00', '{"patrimonio":"PROV-2025-00034","tipo":"provisorio"}', '{"patrimonio":"PAT-2025-00034","tipo":"definitivo"}'),
('edicao', 'Bem editado: Ar Condicionado Split 12.000 BTUs', 'Estado de conservacao alterado de Bom para Regular', 5, 'Carlos Souza', 'assistente', 'bem', '4', 'Ar Condicionado Split 12.000 BTUs', NULL, '2025-02-08 10:30:00', '{"estadoConservacao":"Bom"}', '{"estadoConservacao":"Regular"}'),
('manutencao', 'Bem enviado para manutencao: Ar Condicionado Split 12.000 BTUs', 'Problema: compressor com defeito. Tecnico: Refrigeracao Central Ltda', 5, 'Carlos Souza', 'assistente', 'bem', '4', 'Ar Condicionado Split 12.000 BTUs', NULL, '2025-02-07 15:00:00', '{"status":"ativo"}', '{"status":"em_manutencao"}'),
('exclusao', 'Bem excluido: Monitor LG 22 polegadas', 'Motivo: equipamento inoperante sem possibilidade de reparo. Processo de baixa #2025-012', 1, 'Roberto Gomes', 'administrador', 'bem', 'deleted-001', 'Monitor LG 22 polegadas', NULL, '2025-02-07 09:20:00', '{"patrimonio":"PAT-2023-00112","status":"baixado","valor":890}', NULL),
('baixa', 'Baixa patrimonial: Projetor Epson PowerLite', 'Motivo: defeito irreparavel. Laudo tecnico anexo ao processo', 1, 'Roberto Gomes', 'administrador', 'bem', '7', 'Projetor Epson PowerLite', NULL, '2025-02-06 14:45:00', '{"status":"em_manutencao"}', '{"status":"baixado"}'),
('usuario_criado', 'Novo usuario criado: Carlos Souza', 'Perfil: Assistente de Unidade - Sec. Saude / Atencao Basica', 1, 'Roberto Gomes', 'administrador', 'usuario', '5', 'Carlos Souza', NULL, '2025-02-05 08:30:00', NULL, '{"role":"assistente","secretaria":"Secretaria de Saude","departamento":"Atencao Basica"}'),
('usuario_desativado', 'Usuario desativado: Ana Oliveira', 'Motivo: transferencia para outro orgao', 1, 'Roberto Gomes', 'administrador', 'usuario', '6', 'Ana Oliveira', NULL, '2025-02-04 17:00:00', '{"ativo":true}', '{"ativo":false}'),
('etiqueta_gerada', 'Etiquetas geradas para 3 bens', 'PAT-2024-00142, PAT-2024-00178, PAT-2024-00321', 2, 'Claudia Ferreira', 'gestor', NULL, NULL, NULL, NULL, '2025-02-04 11:15:00', NULL, NULL),
('relatorio_gerado', 'Relatorio gerado: Inventario Geral por Secretaria', 'Formato PDF - Todas as secretarias - 14 bens incluidos', 2, 'Claudia Ferreira', 'gestor', 'relatorio', 'rel-001', 'Inventario Geral', NULL, '2025-02-03 16:30:00', NULL, NULL),
('login', 'Login realizado no sistema', NULL, 2, 'Claudia Ferreira', 'gestor', NULL, NULL, NULL, '192.168.1.105', '2025-02-03 08:00:00', NULL, NULL),
('cadastro', 'Novo bem cadastrado: Scanner de Documentos Fujitsu', 'Cadastro individual com patrimonio provisorio PROV-2025-00098', 3, 'Maria Silva', 'assistente', 'bem', '8', 'Scanner de Documentos Fujitsu', NULL, '2025-02-02 10:00:00', NULL, '{"patrimonio":"PROV-2025-00098","categoria":"informatica","valor":4100}'),
('transferencia', 'Transferencia: Mesa de Escritorio em L - Compras para Contabilidade', 'Transferencia definitiva para setor de contabilidade', 1, 'Roberto Gomes', 'administrador', 'movimentacao', '3', 'Mesa de Escritorio em L', NULL, '2025-02-01 13:40:00', '{"secretaria":"Sec. Administracao","departamento":"Compras e Licitacoes"}', '{"secretaria":"Sec. Financas","departamento":"Contabilidade"}'),
('login', 'Login realizado no sistema', NULL, 4, 'Joao Santos', 'assistente', NULL, NULL, NULL, '192.168.1.115', '2025-01-31 07:50:00', NULL, NULL),
('edicao', 'Veiculo editado: Onibus Escolar Iveco City Class', 'Quilometragem atualizada: 87200 -> 89700 km', 4, 'Joao Santos', 'assistente', 'veiculo', '14', 'Onibus Escolar Iveco City Class', NULL, '2025-01-31 09:15:00', '{"kmAtual":87200}', '{"kmAtual":89700}');
*/

-- Configuracoes PDF
INSERT INTO pdf_settings (nome_orgao, subtitulo, endereco, telefone, email, site, cnpj, logo_url, rodape, mostrar_logo, mostrar_data_hora, mostrar_numero_pagina, mostrar_assinatura, assinatura_texto, assinatura_cargo) VALUES
('Prefeitura Municipal de Exemplo', 'Secretaria de Administracao - Departamento de Patrimonio', 'Rua Principal, 100 - Centro - CEP 12345-678', '(11) 3456-7890', 'patrimonio@prefeitura.gov.br', 'www.prefeitura.gov.br', '12.345.678/0001-90', NULL, 'Documento gerado pelo SisPatrimonio - Sistema de Controle Patrimonial Municipal', 1, 1, 1, 1, 'Responsavel pelo Patrimonio', 'Chefe do Departamento de Patrimonio');

-- Configuracoes do Sistema
INSERT INTO system_settings (id, theme_color, sidebar_color) VALUES (1, 'blue', 'dark');

-- Notificacoes demo (Comentado pois refere a usuarios demo)
/*
INSERT INTO notificacoes (usuario_id, role_destino, titulo, mensagem, tipo, lida, link, criado_em) VALUES
(NULL, 'gestor', 'Bens aguardando patrimonio definitivo', '3 bens com patrimonio provisorio aguardam atribuicao de patrimonio definitivo.', 'warning', 0, 'pendencias', '2025-02-10 09:00:00'),
(NULL, 'administrador', 'Emprestimo atrasado', 'O emprestimo do Scanner de Documentos Fujitsu esta atrasado desde 05/02/2025.', 'error', 0, 'emprestimos', '2025-02-10 08:00:00'),
(3, NULL, 'Novo bem recebido na sua unidade', 'Um Computador Dell OptiPlex 7010 foi transferido para Recursos Humanos.', 'info', 0, 'bens', '2025-02-09 12:00:00'),
(NULL, 'gestor', 'Relatorio mensal disponivel', 'O inventario geral de Janeiro/2025 esta disponivel para consulta.', 'success', 1, 'relatorios', '2025-02-01 08:00:00'),
(NULL, 'administrador', 'Novo usuario cadastrado', 'O usuario Carlos Souza foi cadastrado como Assistente de Unidade.', 'info', 1, 'admin-usuarios', '2025-01-12 08:30:00');
*/