-- Inserir Alienacao 1: Leilao
INSERT INTO alienacoes (
  tipo, numero_processo, numero_edital, data_abertura, observacoes, criado_por, status, valor_total_avaliacao, valor_total_itens
) VALUES (
  'leilao', 'PROC-2024/001', 'EDITAL-01/2024', '2024-02-15', 'Leilao de veiculos inserviveis da frota municipal.', 1, 'aberto', 45000.00, 2
);

SET @id1 = LAST_INSERT_ID();

-- Itens da Alienacao 1 (assumindo bens existentes com IDs 11 e 12 - Veiculos)
INSERT INTO alienacao_itens (alienacao_id, bem_id, valor_aquisicao, valor_contabil, valor_avaliacao, status_item) 
VALUES 
(@id1, 11, 95000.00, 80000.00, 35000.00, 'pendente'),
(@id1, 12, 88000.00, 75000.00, 10000.00, 'pendente');

-- Comissao da Alienacao 1
INSERT INTO alienacao_comissao (alienacao_id, nome, cargo, cpf, tipo_membro) VALUES 
(@id1, 'Joao Silva', 'Auditor Fiscal', '123.456.789-00', 'presidente'),
(@id1, 'Maria Oliveira', 'Contadora', '987.654.321-00', 'membro'),
(@id1, 'Carlos Santos', 'Administrador', '111.222.333-44', 'secretario');


-- Inserir Alienacao 2: Doacao
INSERT INTO alienacoes (
  tipo, numero_processo, data_abertura, observacoes, criado_por, status, valor_total_avaliacao, valor_total_itens
) VALUES (
  'doacao', 'PROC-2024/005', '2024-03-01', 'Doacao de computadores antigos para escolas estaduais.', 1, 'aberto', 12000.00, 3
);

SET @id2 = LAST_INSERT_ID();

-- Itens da Alienacao 2 (assumindo bens existentes com IDs 1, 2 e 3)
INSERT INTO alienacao_itens (alienacao_id, bem_id, valor_aquisicao, valor_contabil, valor_avaliacao, status_item) 
VALUES 
(@id2, 1, 4500.00, 3000.00, 1500.00, 'pendente'),
(@id2, 2, 3200.00, 2500.00, 1200.00, 'pendente'),
(@id2, 3, 1200.00, 800.00, 500.00, 'pendente');

-- Comissao da Alienacao 2
INSERT INTO alienacao_comissao (alienacao_id, nome, cargo, cpf, tipo_membro) VALUES 
(@id2, 'Ana Pereira', 'Diretora de Ensino', '555.666.777-88', 'presidente'),
(@id2, 'Pedro Lima', 'Tecnico de TI', '999.888.777-66', 'membro'),
(@id2, 'Lucia Costa', 'Assistente Social', '444.555.666-77', 'membro');
