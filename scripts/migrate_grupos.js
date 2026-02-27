const { query, execute } = require('../lib/db');

async function migrate() {
  console.log('Criando tabela grupos...');
  await execute(`
    CREATE TABLE IF NOT EXISTS grupos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(100) NOT NULL UNIQUE
    )
  `);

  console.log('Migrando dados existentes...');
  const existingGroups = await query("SELECT DISTINCT grupo FROM bens WHERE grupo IS NOT NULL AND grupo != ''");
  
  for (const row of existingGroups) {
      try {
        await execute("INSERT INTO grupos (nome) VALUES (?)", [row.grupo]);
        console.log(`Migrado: ${row.grupo}`);
      } catch (e) {
        // Ignore dupes
      }
  }
  
  // Ensure Geral exists
  try {
    await execute("INSERT INTO grupos (nome) VALUES ('Geral')");
  } catch(e) {}
  
  console.log('Concluído.');
  process.exit(0);
}

migrate();
