-- Patch v10: limpa status antigos de etiqueta criados automaticamente
-- Mantem historico apenas dos bens realmente enviados para unidade ou ja confirmados.

UPDATE bens
SET
  etiqueta_status = NULL,
  etiqueta_enviada_em = NULL,
  etiqueta_enviada_por = NULL,
  etiqueta_colada_em = NULL,
  etiqueta_colada_por = NULL
WHERE etiqueta_status = 'pendente';
