-- SisPatrimonio - Patch incremental para assistente multi-departamento
-- Data: 2026-05-13

USE sispatrimonio;

CREATE TABLE IF NOT EXISTS departamentos_assistente (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario_id INT NOT NULL,
  secretaria VARCHAR(200) NOT NULL,
  departamento VARCHAR(200) NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_assistente_departamento (usuario_id, secretaria, departamento),
  KEY idx_assistente_secretaria (secretaria),
  KEY idx_assistente_departamento (departamento),
  CONSTRAINT departamentos_assistente_ibfk_1
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO departamentos_assistente (usuario_id, secretaria, departamento)
SELECT id, unidade_secretaria, unidade_departamento
  FROM usuarios
 WHERE role = 'assistente'
   AND unidade_secretaria IS NOT NULL
   AND unidade_secretaria <> ''
   AND unidade_departamento IS NOT NULL
   AND unidade_departamento <> '';
