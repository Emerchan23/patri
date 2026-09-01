
const mysql = require('mysql2/promise');

async function fix() {
    try {
        console.log('Connecting to DB via Node.js driver...');
        const conn = await mysql.createConnection({
            host: process.env.DB_HOST || 'db',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || 'root',
            database: process.env.DB_NAME || 'sispatrimonio'
        });
        
        console.log('Connected! Changing root password plugin to mysql_native_password...');
        // Change auth plugin for root
        await conn.query("ALTER USER 'root'@'%' IDENTIFIED WITH mysql_native_password BY 'root';");
        // Also for 'root'@'localhost' just in case
        try {
            await conn.query("ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'root';");
        } catch (e) { /* ignore if not exists */ }
        
        await conn.query("FLUSH PRIVILEGES;");
        
        console.log('SUCCESS: Authentication plugin updated.');
        await conn.end();
    } catch (err) {
        console.error('ERROR:', err);
        process.exit(1);
    }
}

fix();
