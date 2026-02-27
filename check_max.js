
const mysql = require('mysql2/promise');

async function checkMaxValues() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "sispatrimonio",
  });

  try {
    console.log("Checking max values...");
    
    const [rowsId] = await connection.execute("SELECT MAX(id) as max_id, COUNT(*) as count FROM bens");
    console.log("Max ID:", rowsId[0].max_id, "Count:", rowsId[0].count);

    const [rowsPat] = await connection.execute("SELECT patrimonio FROM bens ORDER BY length(patrimonio) DESC, patrimonio DESC LIMIT 5");
    console.log("Top 5 Patrimonios:", rowsPat.map(r => r.patrimonio));

    const [rowsProv] = await connection.execute("SELECT patrimonio_provisorio FROM bens WHERE patrimonio_provisorio IS NOT NULL ORDER BY length(patrimonio_provisorio) DESC, patrimonio_provisorio DESC LIMIT 5");
    console.log("Top 5 Provisorios:", rowsProv.map(r => r.patrimonio_provisorio));
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await connection.end();
  }
}

checkMaxValues();
