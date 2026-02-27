const mysql = require('mysql2/promise');
require('dotenv').config();

async function testQuery() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'sispatrimonio'
    });

    console.log('Connected to database.');

    const sql = "SELECT * FROM bens WHERE categoria_slug = 'veiculo' ORDER BY modelo ASC";
    console.log(`Executing query: ${sql}`);

    const [rows] = await connection.execute(sql);
    console.log(`Query successful. Returned ${rows.length} rows.`);
    if (rows.length > 0) {
      console.log('First row sample:', rows[0]);
    }

    await connection.end();
  } catch (error) {
    console.error('Query failed:', error);
  }
}

testQuery();
