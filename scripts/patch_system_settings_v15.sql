-- SIS Patrimônio: esquema explícito para configurações globais (v15).
-- Execute primeiro em homologação, após backup do banco.
-- As rotas/login apenas leem INFORMATION_SCHEMA e não aplicam DDL.

CREATE TABLE IF NOT EXISTS system_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  theme_color VARCHAR(50) DEFAULT 'blue',
  sidebar_color VARCHAR(50) DEFAULT 'dark',
  link_extensao_xml VARCHAR(500) DEFAULT 'https://chromewebstore.google.com/detail/fsist-download-xml-nfe/jclbljmbidghoecicnjofjldjndabajp',
  link_portal_sefaz VARCHAR(500) DEFAULT 'https://www.fsist.com.br/',
  session_days_web INT NOT NULL DEFAULT 3,
  session_days_mobile INT NOT NULL DEFAULT 30,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS theme_color VARCHAR(50) DEFAULT 'blue',
  ADD COLUMN IF NOT EXISTS sidebar_color VARCHAR(50) DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS link_extensao_xml VARCHAR(500) DEFAULT 'https://chromewebstore.google.com/detail/fsist-download-xml-nfe/jclbljmbidghoecicnjofjldjndabajp',
  ADD COLUMN IF NOT EXISTS link_portal_sefaz VARCHAR(500) DEFAULT 'https://www.fsist.com.br/',
  ADD COLUMN IF NOT EXISTS session_days_web INT NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS session_days_mobile INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

INSERT INTO system_settings
  (id, theme_color, sidebar_color, link_extensao_xml, link_portal_sefaz, session_days_web, session_days_mobile)
SELECT
  1, 'blue', 'dark',
  'https://chromewebstore.google.com/detail/fsist-download-xml-nfe/jclbljmbidghoecicnjofjldjndabajp',
  'https://www.fsist.com.br/', 3, 30
WHERE NOT EXISTS (SELECT 1 FROM system_settings);
