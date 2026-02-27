
const mysql = require('mysql2/promise');
require('dotenv').config();

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sispatrimonio'
  });

  try {
    console.log('Creating servidores table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS servidores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        cargo VARCHAR(255) NOT NULL,
        cpf VARCHAR(20) DEFAULT NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('Table servidores created successfully.');
  } catch (error) {
    console.error('Error creating table:', error);
  } finally {
    await connection.end();
  }
}

main();
