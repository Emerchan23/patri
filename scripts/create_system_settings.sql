
-- Tabela para configuracoes do sistema (tema, cores, etc)
CREATE TABLE IF NOT EXISTS system_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  theme_color VARCHAR(50) DEFAULT 'blue',
  sidebar_color VARCHAR(50) DEFAULT 'dark',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Inserir configuracao padrao se nao existir
INSERT IGNORE INTO system_settings (id, theme_color, sidebar_color) VALUES (1, 'blue', 'dark');
