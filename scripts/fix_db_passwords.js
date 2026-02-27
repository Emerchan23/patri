const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

// Configuration
const dbConfig = {
    host: process.env.DB_HOST || 'db',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'sispatrimonio'
};

const usersToFix = [
    { email: 'admin@prefeitura.gov.br', password: 'admin123' },
    { email: 'gestor@prefeitura.gov.br', password: 'gestor123' },
    { email: 'maria@prefeitura.gov.br', password: 'maria123' },
    { email: 'joao@prefeitura.gov.br', password: 'joao123' },
    { email: 'carlos@prefeitura.gov.br', password: 'carlos123' },
    { email: 'ana@prefeitura.gov.br', password: 'ana123' }
];

async function fixPasswords() {
    let connection;
    try {
        console.log('Connecting to database...', dbConfig.host);
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected!');

        for (const user of usersToFix) {
            const hash = bcrypt.hashSync(user.password, 12);
            console.log(`Updating password for ${user.email} -> ${hash.substring(0, 10)}...`);
            
            const [result] = await connection.execute(
                'UPDATE usuarios SET senha_hash = ? WHERE email = ?',
                [hash, user.email]
            );

            if (result.affectedRows > 0) {
                console.log(`Success: Updated ${user.email}`);
            } else {
                console.warn(`Warning: User ${user.email} not found.`);
            }
        }

        console.log('Password update complete!');
    } catch (error) {
        console.error('Error updating passwords:', error);
    } finally {
        if (connection) await connection.end();
    }
}

fixPasswords();
