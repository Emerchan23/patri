-- Patch incremental para sessao configuravel por canal
-- Data: 2026-05-15

USE sispatrimonio;

CREATE TABLE IF NOT EXISTS system_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  theme_color VARCHAR(50) DEFAULT 'blue',
  sidebar_color VARCHAR(50) DEFAULT 'dark',
  link_extensao_xml VARCHAR(500) DEFAULT 'https://chromewebstore.google.com/detail/fsist-download-xml-nfe/jclbljmbidghoecicnjofjldjndabajp',
  session_days_web INT NOT NULL DEFAULT 3,
  session_days_mobile INT NOT NULL DEFAULT 30,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS session_days_web INT NOT NULL DEFAULT 3;

ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS session_days_mobile INT NOT NULL DEFAULT 30;
