CREATE TABLE IF NOT EXISTS termos_responsabilidade (
  id INT AUTO_INCREMENT PRIMARY KEY,
  emprestimo_id INT NOT NULL UNIQUE,
  bem_id INT NULL,
  patrimonio VARCHAR(100) NOT NULL,
  responsavel_nome VARCHAR(200) NOT NULL,
  responsavel_cargo VARCHAR(200) NULL,
  status ENUM('gerado','assinado') NOT NULL DEFAULT 'gerado',
  gerado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  gerado_por_usuario_id INT NULL,
  assinado_em DATETIME NULL,
  assinado_por_usuario_id INT NULL,
  arquivo_assinado VARCHAR(500) NULL,
  FOREIGN KEY (emprestimo_id) REFERENCES emprestimos(id) ON DELETE CASCADE,
  FOREIGN KEY (bem_id) REFERENCES bens(id) ON DELETE SET NULL,
  INDEX idx_termos_status (status),
  INDEX idx_termos_bem (bem_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
