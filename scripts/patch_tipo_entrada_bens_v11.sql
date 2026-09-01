ALTER TABLE bens
  ADD COLUMN IF NOT EXISTS tipo_entrada VARCHAR(50) NOT NULL DEFAULT 'compra' AFTER emenda_parlamentar;

UPDATE bens
   SET tipo_entrada = 'compra'
 WHERE tipo_entrada IS NULL
    OR tipo_entrada = '';
