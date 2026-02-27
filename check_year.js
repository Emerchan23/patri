
const mysql = require('mysql2/promise');

async function checkCurrentYear() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "sispatrimonio",
  });

  try {
    const currentYear = new Date().getFullYear();
    console.log(`Checking for year ${currentYear}...`);
    
    const [rows] = await connection.execute(
        `SELECT patrimonio_provisorio FROM bens WHERE patrimonio_provisorio LIKE 'PROV-${currentYear}-%' ORDER BY patrimonio_provisorio DESC LIMIT 10`
    );
    console.log("Top 10 Provisorios current year:", rows.map(r => r.patrimonio_provisorio));

    const [rowsTags] = await connection.execute(
        `SELECT codigo FROM etiquetas_provisorias WHERE codigo LIKE 'PROV-${currentYear}-%' ORDER BY codigo DESC LIMIT 10`
    );
    console.log("Top 10 Tags current year:", rowsTags.map(r => r.codigo));

    // Check for "definitive" assets that might be just numbers
    const [rowsDef] = await connection.execute(
        `SELECT patrimonio FROM bens WHERE patrimonio REGEXP '^[0-9]+$' ORDER BY CAST(patrimonio AS UNSIGNED) DESC LIMIT 10`
    );
    console.log("Top 10 Definitive (Numeric):", rowsDef.map(r => r.patrimonio));

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await connection.end();
  }
}

checkCurrentYear();
