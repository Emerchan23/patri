const mysql = require('mysql2/promise');

async function migrate() {
  console.log('Conectando ao banco de dados...');
  
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'sispatrimonio'
  });

  try {
    // 1. Garantir que a coluna grupo existe em bens
    console.log('Verificando coluna grupo em bens...');
    try {
      await connection.execute("ALTER TABLE bens ADD COLUMN grupo VARCHAR(100) NOT NULL DEFAULT 'Geral'");
      console.log("- Coluna grupo adicionada.");
      // Adicionar index se não existir (mysql não tem IF NOT EXISTS para index fácil, ignorar erro)
      try { await connection.execute("CREATE INDEX idx_bens_grupo ON bens(grupo)"); } catch(e) {}
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log("- Coluna grupo já existe.");
      } else {
        console.error("- Erro ao adicionar coluna:", e.message);
      }
    }

    // 2. Criar tabela grupos
    console.log('Criando tabela grupos...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS grupos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(100) NOT NULL UNIQUE
      )
    `);

    // 3. Migrar dados
    console.log('Migrando dados existentes de bens para grupos...');
    const [rows] = await connection.execute("SELECT DISTINCT grupo FROM bens WHERE grupo IS NOT NULL AND grupo != ''");
    
    let count = 0;
    for (const row of rows) {
        try {
          await connection.execute("INSERT IGNORE INTO grupos (nome) VALUES (?)", [row.grupo]);
          console.log(`- Grupo migrado: ${row.grupo}`);
          count++;
        } catch (e) {
          // ignore
        }
    }
    
    // Garantir grupo Geral
    await connection.execute("INSERT IGNORE INTO grupos (nome) VALUES ('Geral')");
    console.log(`Migração concluída.`);

  } catch (err) {
    console.error('Erro geral:', err);
  } finally {
    await connection.end();
  }
}

migrate();
