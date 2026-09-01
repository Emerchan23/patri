-- Permite emprestimos sem prazo definido para devolucao.
ALTER TABLE emprestimos
  MODIFY COLUMN data_prevista_devolucao DATE NULL DEFAULT NULL;
