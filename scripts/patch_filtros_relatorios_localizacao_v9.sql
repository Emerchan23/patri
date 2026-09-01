-- Patch v9: indices de apoio para filtros por secretaria/departamento/sala
-- Movimentacoes e emprestimos usam filtros por origem ou destino.

ALTER TABLE movimentacoes
  ADD INDEX idx_movimentacoes_origem_local (de_secretaria, de_departamento, de_sala),
  ADD INDEX idx_movimentacoes_destino_local (para_secretaria, para_departamento, para_sala);

ALTER TABLE emprestimos
  ADD INDEX idx_emprestimos_origem_local (origem_secretaria, origem_departamento, origem_sala),
  ADD INDEX idx_emprestimos_destino_local (destino_secretaria, destino_departamento, destino_sala);
