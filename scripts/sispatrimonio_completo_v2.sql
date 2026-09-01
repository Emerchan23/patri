-- =============================================
-- SisPatrimonio - Script de Inicialização Completo (Consolidado)
-- Versão: 3.0 FINAL
-- Data: 2026-03-12
-- Descrição: Contém TODAS as tabelas, colunas, correções e dados iniciais.
-- Uso: Copiar para /docker-entrypoint-initdb.d/init.sql no container MariaDB.
-- =============================================

CREATE DATABASE IF NOT EXISTS sispatrimonio CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sispatrimonio;

-- =============================================
-- 1. TABELAS DE USUÁRIOS E PERMISSÕES
-- =============================================

-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  email VARCHAR(200) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  cargo VARCHAR(200) NOT NULL,
  role ENUM('administrador','gestor','assistente') NOT NULL DEFAULT 'assistente',
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  acesso_app TINYINT(1) NOT NULL DEFAULT 0,
  avatar VARCHAR(10) NOT NULL DEFAULT '',
  unidade_secretaria VARCHAR(200) DEFAULT NULL,
  unidade_departamento VARCHAR(200) DEFAULT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_acesso DATETIME DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Secretarias gerenciadas pelo gestor
CREATE TABLE IF NOT EXISTS secretarias_gerenciadas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  secretaria VARCHAR(200) NOT NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS departamentos_assistente (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  secretaria VARCHAR(200) NOT NULL,
  departamento VARCHAR(200) NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_assistente_departamento (usuario_id, secretaria, departamento),
  KEY idx_assistente_secretaria (secretaria),
  KEY idx_assistente_departamento (departamento),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sessões de Login
CREATE TABLE IF NOT EXISTS sessoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  ip VARCHAR(50) DEFAULT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expira_em DATETIME NOT NULL,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 2. CADASTROS AUXILIARES (Localização e Categorização)
-- =============================================

-- Secretarias
CREATE TABLE IF NOT EXISTS secretarias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(200) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Departamentos
CREATE TABLE IF NOT EXISTS departamentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  secretaria_id INT NOT NULL,
  nome VARCHAR(200) NOT NULL,
  FOREIGN KEY (secretaria_id) REFERENCES secretarias(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Salas
CREATE TABLE IF NOT EXISTS salas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  departamento_id INT NOT NULL,
  nome VARCHAR(200) NOT NULL,
  FOREIGN KEY (departamento_id) REFERENCES departamentos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Categorias
CREATE TABLE IF NOT EXISTS categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL UNIQUE,
  descricao TEXT DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Marcas
CREATE TABLE IF NOT EXISTS marcas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(200) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Grupos
CREATE TABLE IF NOT EXISTS grupos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fornecedores (Completo com campos adicionais)
CREATE TABLE IF NOT EXISTS fornecedores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cnpj VARCHAR(20) DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  telefone VARCHAR(50) DEFAULT NULL,
  endereco TEXT DEFAULT NULL,
  razao_social VARCHAR(255) DEFAULT NULL,
  estado VARCHAR(2) DEFAULT NULL,
  cidade VARCHAR(100) DEFAULT NULL,
  nome_fantasia VARCHAR(255) DEFAULT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Servidores
CREATE TABLE IF NOT EXISTS servidores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  cargo VARCHAR(255) NOT NULL,
  cpf VARCHAR(20) DEFAULT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 3. BENS E PATRIMÔNIO
-- =============================================

CREATE TABLE IF NOT EXISTS bens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patrimonio VARCHAR(50) NOT NULL UNIQUE,
  patrimonio_provisorio VARCHAR(50) DEFAULT NULL,
  patrimonio_tipo ENUM('definitivo','provisorio') NOT NULL DEFAULT 'provisorio',
  etiqueta_status ENUM('pendente','enviada','colada') DEFAULT NULL,
  etiqueta_enviada_em DATETIME DEFAULT NULL,
  etiqueta_enviada_por VARCHAR(255) DEFAULT NULL,
  etiqueta_colada_em DATETIME DEFAULT NULL,
  etiqueta_colada_por VARCHAR(255) DEFAULT NULL,
  descricao VARCHAR(500) NOT NULL,
  categoria_slug VARCHAR(200) NOT NULL,
  grupo VARCHAR(100) NOT NULL DEFAULT 'Geral',
  
  -- Localização
  localizacao_secretaria VARCHAR(200) NOT NULL,
  localizacao_departamento VARCHAR(200) NOT NULL,
  localizacao_sala VARCHAR(200) NOT NULL,
  
  -- Responsável
  responsavel_nome VARCHAR(200) NOT NULL,
  responsavel_cargo VARCHAR(200) NOT NULL,
  
  -- Detalhes da Aquisição
  data_aquisicao DATE NOT NULL,
  valor DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  status ENUM('ativo','em_manutencao','baixado','transferido','emprestado') NOT NULL DEFAULT 'ativo',
  motivo_baixa TEXT DEFAULT NULL,
  tempo_garantia INT DEFAULT NULL,
  fornecedor VARCHAR(255) DEFAULT NULL,
  nota_fiscal_url VARCHAR(255) DEFAULT NULL,
  emenda_parlamentar VARCHAR(255) DEFAULT NULL,
  tipo_entrada VARCHAR(50) NOT NULL DEFAULT 'compra',
  
  -- Detalhes do Bem
  marca VARCHAR(200) DEFAULT NULL,
  modelo VARCHAR(200) DEFAULT NULL,
  numero_serie VARCHAR(200) DEFAULT NULL,
  estado_conservacao VARCHAR(50) DEFAULT NULL,
  observacoes TEXT DEFAULT NULL,
  imagem LONGTEXT DEFAULT NULL,
  
  -- Veículos
  placa VARCHAR(20) DEFAULT NULL,
  ano INT DEFAULT NULL,
  km_atual INT DEFAULT NULL,
  
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Etiquetas Provisórias
CREATE TABLE IF NOT EXISTS etiquetas_provisorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  gerado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('reservada', 'em_uso', 'usada', 'cancelada', 'disponivel_para_reuso', 'disponivel') NOT NULL DEFAULT 'reservada',
  bem_id INT DEFAULT NULL,
  lote_id INT DEFAULT NULL,
  observacao TEXT DEFAULT NULL,
  emenda_parlamentar VARCHAR(255) DEFAULT NULL,
  reservado_por_usuario_id INT DEFAULT NULL,
  reservado_por_nome VARCHAR(255) DEFAULT NULL,
  cancelado_em DATETIME DEFAULT NULL,
  usado_em DATETIME DEFAULT NULL,
  INDEX idx_etiqueta_status (status),
  INDEX idx_etiqueta_lote (lote_id),
  FOREIGN KEY (bem_id) REFERENCES bens(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS etiquetas_provisorias_lotes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ano VARCHAR(4) NOT NULL,
  quantidade INT NOT NULL,
  origem_reserva ENUM('automatico','faixa_manual') NOT NULL DEFAULT 'automatico',
  faixa_inicial VARCHAR(50) NOT NULL,
  faixa_final VARCHAR(50) NOT NULL,
  status ENUM('reservado','parcialmente_usado','usado','cancelado') NOT NULL DEFAULT 'reservado',
  observacao TEXT DEFAULT NULL,
  emenda_parlamentar VARCHAR(255) DEFAULT NULL,
  criado_por_usuario_id INT DEFAULT NULL,
  criado_por_nome VARCHAR(255) DEFAULT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_lote_status (status),
  INDEX idx_lote_ano (ano)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS etiquetas_provisorias_sequence_settings (
  ano VARCHAR(4) NOT NULL PRIMARY KEY,
  proximo_numero_manual INT DEFAULT NULL,
  origem_ajuste ENUM('manual', 'realinhamento_seguro') DEFAULT NULL,
  atualizado_por_usuario_id INT DEFAULT NULL,
  atualizado_por_nome VARCHAR(255) DEFAULT NULL,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS etiquetas_provisorias_faixas_livres (
  id INT AUTO_INCREMENT PRIMARY KEY,
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO etiquetas_layout_settings
  (preset_key, title, subtitle, show_description, show_emenda, show_location, show_footer, show_parent, qr_size_mm,
   offset_x_mm, offset_y_mm, offset_coluna_2_mm, altura_extra_mm, inner_padding_mm)
VALUES
  ('patrimonio_provisorio', '', '', 1, 1, 0, 1, 0, 16, 0, 1, 3, 20, 1.5),
  ('qr_cadastro', 'Identificacao de Ambiente', '', 0, 0, 0, 1, 1, 17, 0, 1, 3, 20, 1.5)
ON DUPLICATE KEY UPDATE preset_key = preset_key;

-- =============================================
-- 4. MOVIMENTAÇÕES E EMPRÉSTIMOS
-- =============================================

-- Movimentações
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

CREATE TABLE IF NOT EXISTS solicitacoes_movimentacao (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  solicitante_usuario_id INT NOT NULL,
  solicitante_nome VARCHAR(255) NOT NULL,
  solicitante_role VARCHAR(50) NOT NULL,
  secretaria_origem VARCHAR(255) NOT NULL,
  secretaria_destino VARCHAR(255) NOT NULL,
  departamento_destino VARCHAR(255) NOT NULL,
  sala_destino VARCHAR(255) NOT NULL,
  motivo TEXT NOT NULL,
  status ENUM('pendente', 'aprovada', 'rejeitada', 'cancelada') NOT NULL DEFAULT 'pendente',
  motivo_rejeicao TEXT DEFAULT NULL,
  aprovado_por_usuario_id INT DEFAULT NULL,
  aprovado_por_nome VARCHAR(255) DEFAULT NULL,
  rejeitado_por_usuario_id INT DEFAULT NULL,
  rejeitado_por_nome VARCHAR(255) DEFAULT NULL,
  cancelado_por_usuario_id INT DEFAULT NULL,
  cancelado_por_nome VARCHAR(255) DEFAULT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decidido_em DATETIME DEFAULT NULL,
  cancelado_em DATETIME DEFAULT NULL,
  KEY idx_solicitacao_status (status),
  KEY idx_solicitacao_secretaria_origem (secretaria_origem),
  KEY idx_solicitacao_secretaria_destino (secretaria_destino),
  KEY idx_solicitacao_solicitante (solicitante_usuario_id),
  FOREIGN KEY (solicitante_usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS solicitacoes_movimentacao_itens (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  solicitacao_id INT NOT NULL,
  bem_id INT NOT NULL,
  patrimonio VARCHAR(100) NOT NULL,
  bem_descricao VARCHAR(255) NOT NULL,
  de_secretaria VARCHAR(255) DEFAULT NULL,
  de_departamento VARCHAR(255) DEFAULT NULL,
  de_sala VARCHAR(255) DEFAULT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_solicitacao_item_solicitacao (solicitacao_id),
  KEY idx_solicitacao_item_bem (bem_id),
  FOREIGN KEY (solicitacao_id) REFERENCES solicitacoes_movimentacao(id) ON DELETE CASCADE,
  FOREIGN KEY (bem_id) REFERENCES bens(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Empréstimos
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
  data_prevista_devolucao DATE DEFAULT NULL,
  data_devolucao DATE DEFAULT NULL,
  motivo TEXT NOT NULL,
  observacoes TEXT DEFAULT NULL,
  status ENUM('ativo','devolvido','atrasado') NOT NULL DEFAULT 'ativo',
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bem_id) REFERENCES bens(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 5. MÓDULO DE ALIENAÇÃO
-- =============================================

-- Tabela Principal de Alienações
CREATE TABLE IF NOT EXISTS alienacoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tipo ENUM('venda', 'leilao', 'doacao', 'permuta', 'descarte') NOT NULL,
  numero_processo VARCHAR(50) NOT NULL COMMENT 'Numero do Processo Administrativo',
  numero_edital VARCHAR(50) DEFAULT NULL COMMENT 'Numero do Edital (apenas para leilao)',
  data_abertura DATE NOT NULL,
  data_conclusao DATE DEFAULT NULL,
  status ENUM('aberto', 'em_avaliacao', 'concluido', 'cancelado') NOT NULL DEFAULT 'aberto',
  
  -- Destinatário
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

-- Itens da Alienação
CREATE TABLE IF NOT EXISTS alienacao_itens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  alienacao_id INT NOT NULL,
  bem_id INT NOT NULL,
  
  -- Valores do Bem no momento da inclusão (Snapshot)
  valor_aquisicao DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  valor_contabil DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  
  -- Valores do Processo
  valor_avaliacao DECIMAL(15,2) DEFAULT 0.00 COMMENT 'Valor de Mercado estipulado pela comissao',
  valor_alienado DECIMAL(15,2) DEFAULT 0.00 COMMENT 'Valor final de venda/arremate',
  
  status_item ENUM('pendente', 'alienado', 'removido') DEFAULT 'pendente',
  
  FOREIGN KEY (alienacao_id) REFERENCES alienacoes(id) ON DELETE CASCADE,
  FOREIGN KEY (bem_id) REFERENCES bens(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Comissão de Avaliação
CREATE TABLE IF NOT EXISTS alienacao_comissao (
  id INT AUTO_INCREMENT PRIMARY KEY,
  alienacao_id INT NOT NULL,
  nome VARCHAR(200) NOT NULL,
  cargo VARCHAR(200) NOT NULL,
  cpf VARCHAR(20) DEFAULT NULL,
  tipo_membro ENUM('presidente', 'membro', 'secretario', 'leiloeiro') DEFAULT 'membro',
  FOREIGN KEY (alienacao_id) REFERENCES alienacoes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 6. SISTEMA E LOGS
-- =============================================

-- Logs de auditoria
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

-- Notificações
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

-- Configurações PDF
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

-- Configurações de Integração (API Keys)
CREATE TABLE IF NOT EXISTS api_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL COMMENT 'Nome do sistema externo',
    chave VARCHAR(255) NOT NULL UNIQUE COMMENT 'Chave de API',
    ativo TINYINT(1) DEFAULT 1,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Configurações Gerais do Sistema
CREATE TABLE IF NOT EXISTS system_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  theme_color VARCHAR(50) DEFAULT 'blue',
  sidebar_color VARCHAR(50) DEFAULT 'dark',
  integration_patrimonio_url VARCHAR(255) DEFAULT NULL,
  integration_patrimonio_key VARCHAR(255) DEFAULT NULL,
  link_extensao_xml VARCHAR(500) DEFAULT 'https://chromewebstore.google.com/detail/fsist-download-xml-nfe/jclbljmbidghoecicnjofjldjndabajp',
  session_days_web INT NOT NULL DEFAULT 3,
  session_days_mobile INT NOT NULL DEFAULT 30,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 7. ÍNDICES DE PERFORMANCE
-- =============================================

CREATE INDEX idx_bens_patrimonio ON bens(patrimonio);
CREATE INDEX idx_bens_categoria ON bens(categoria_slug);
CREATE INDEX idx_bens_grupo ON bens(grupo);
CREATE INDEX idx_bens_status ON bens(status);
CREATE INDEX idx_bens_patrimonio_tipo ON bens(patrimonio_tipo);
CREATE INDEX idx_bens_secretaria ON bens(localizacao_secretaria);
CREATE INDEX idx_movimentacoes_bem ON movimentacoes(bem_id);
CREATE INDEX idx_movimentacoes_data ON movimentacoes(data);
CREATE INDEX idx_movimentacoes_origem_local ON movimentacoes(de_secretaria, de_departamento, de_sala);
CREATE INDEX idx_movimentacoes_destino_local ON movimentacoes(para_secretaria, para_departamento, para_sala);
CREATE INDEX idx_emprestimos_bem ON emprestimos(bem_id);
CREATE INDEX idx_emprestimos_status ON emprestimos(status);
CREATE INDEX idx_emprestimos_origem_local ON emprestimos(origem_secretaria, origem_departamento, origem_sala);
CREATE INDEX idx_emprestimos_destino_local ON emprestimos(destino_secretaria, destino_departamento, destino_sala);
CREATE INDEX idx_audit_logs_acao ON audit_logs(acao);
CREATE INDEX idx_audit_logs_data ON audit_logs(data_hora);
CREATE INDEX idx_audit_logs_usuario ON audit_logs(usuario_id);
CREATE INDEX idx_notificacoes_usuario ON notificacoes(usuario_id);
CREATE INDEX idx_notificacoes_role ON notificacoes(role_destino);
CREATE INDEX idx_notificacoes_lida ON notificacoes(lida);
CREATE INDEX idx_sessoes_usuario ON sessoes(usuario_id);
CREATE INDEX idx_sessoes_expira ON sessoes(expira_em);
CREATE INDEX idx_alienacoes_status ON alienacoes(status);
CREATE INDEX idx_alienacoes_tipo ON alienacoes(tipo);
CREATE INDEX idx_alienacao_itens_bem ON alienacao_itens(bem_id);

-- =============================================
-- 8. DADOS INICIAIS (SEED)
-- =============================================

-- Grupos Padrão
INSERT IGNORE INTO grupos (nome) VALUES ('Geral');

-- Usuário Administrador Padrão (admin / admin)
-- Senha hash: $2a$12$yudRm1XiaYfgxlMopum6f.Te6p5XKKobpHAfjHS2jrnncA8AII7W2
INSERT IGNORE INTO usuarios (id, nome, email, senha_hash, cargo, role, ativo, acesso_app, avatar, unidade_secretaria, unidade_departamento, criado_em, ultimo_acesso) VALUES
(1, 'Administrador', 'admin@sistema.local', '$2a$12$Eql3TPXfZDa91wK9AE5PbOp44CFZ44yylDoWqPIq6NuwPPBzQwLH6', 'Diretor de TI', 'administrador', 1, 1, 'AD', NULL, NULL, NOW(), NOW());

-- Categorias Padrão
INSERT IGNORE INTO categorias (nome, slug, descricao) VALUES
('Informatica', 'informatica', 'Computadores, impressoras, scanners e perifericos'),
('Movel', 'movel', 'Mesas, cadeiras, armarios e estantes'),
('Equipamento', 'equipamento', 'Ar condicionado, ferramentas e maquinarios'),
('Eletronico', 'eletronico', 'Projetores, TVs e equipamentos eletronicos'),
('Veiculo', 'veiculo', 'Carros, motos e veiculos em geral');

-- Marcas Comuns
INSERT IGNORE INTO marcas (nome) VALUES
('Dell'), ('HP'), ('Lenovo'), ('Samsung'), ('Epson'),
('Fujitsu'), ('SMS'), ('Planalto'), ('Flexform'), ('Pandin'),
('Fiat'), ('Volkswagen'), ('Renault'), ('Iveco');

-- Estrutura Organizacional Exemplo (Opcional, pode ser removido se desejar sistema vazio)
INSERT IGNORE INTO secretarias (id, nome) VALUES
(1, 'Secretaria Administrativa');

INSERT IGNORE INTO departamentos (id, secretaria_id, nome) VALUES
(1, 1, 'Departamento de TI'),
(2, 1, 'Almoxarifado');

INSERT IGNORE INTO salas (departamento_id, nome) VALUES
(1, 'Servidores'),
(2, 'Deposito 01');

-- Configurações Padrão
INSERT IGNORE INTO system_settings (id, theme_color, sidebar_color) VALUES (1, 'blue', 'dark');

-- Configurações PDF Padrão (Placeholder)
INSERT IGNORE INTO pdf_settings (nome_orgao, subtitulo, endereco, telefone, email, site, cnpj, logo_url, rodape, mostrar_logo, mostrar_data_hora, mostrar_numero_pagina, mostrar_assinatura, assinatura_texto, assinatura_cargo) VALUES
('Prefeitura Municipal', 'Controle Patrimonial', 'Rua Exemplo, 100', '(00) 0000-0000', 'admin@sistema.local', 'www.sistema.local', '00.000.000/0001-00', NULL, 'Sistema de Controle Patrimonial', 1, 1, 1, 1, 'Responsavel', 'Cargo');

-- API Key Padrão para Integrações
INSERT IGNORE INTO api_keys (nome, chave) VALUES ('Sistema Manutencao', 'sispatrimonio-manutencao-secret-key-2025');

-- =============================================
-- 9. AJUSTES FINAIS DE PERMISSÕES
-- =============================================
-- Ajuste de compatibilidade para MariaDB/MySQL
-- Removemos a sintaxe específica do MySQL 8 (IDENTIFIED WITH) e usamos a padrão
ALTER USER 'root'@'%' IDENTIFIED BY 'root';
FLUSH PRIVILEGES;
