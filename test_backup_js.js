
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'sispatrimonio',
};

async function run() {
    console.log('Starting Backup Test...');
    
    // 1. Temp Dir
    const tempDir = path.join(process.cwd(), 'public', 'backup_temp');
    console.log(`Temp Dir: ${tempDir}`);
    
    if (!fs.existsSync(tempDir)) {
        console.log('Creating temp dir...');
        try {
            fs.mkdirSync(tempDir, { recursive: true });
        } catch (e) {
            console.error('Failed to create temp dir:', e);
            process.exit(1);
        }
    }

    const sqlPath = path.join(tempDir, 'test_dump.sql');
    const tarPath = path.join(tempDir, 'test_backup.tar.gz');

    // 2. Dump
    console.log('Dumping database...');
    await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(sqlPath);
        const p = spawn('mysqldump', [
            `-h${DB_CONFIG.host}`,
            `-u${DB_CONFIG.user}`,
            `-p${DB_CONFIG.password}`,
            '--single-transaction',
            '--quick',
            '--skip-ssl',
            DB_CONFIG.database
        ]);
        
        p.stdout.pipe(out);
        
        p.stderr.on('data', d => console.error('DUMP STDERR:', d.toString()));
        
        p.on('close', (code) => {
            if (code === 0) {
                console.log('Dump success!');
                resolve();
            } else {
                reject(new Error(`Dump failed with code ${code}`));
            }
        });
        
        p.on('error', reject);
    });
    
    // Check size
    const stats = fs.statSync(sqlPath);
    console.log(`SQL Size: ${stats.size} bytes`);
    if (stats.size === 0) throw new Error('Empty SQL file');

    // 3. Tar
    console.log('Creating Tar...');
    await new Promise((resolve, reject) => {
        const args = ['-czf', tarPath, '-C', tempDir, 'test_dump.sql'];
        console.log('Tar args:', args);
        
        const p = spawn('tar', args);
        
        p.stderr.on('data', d => console.error('TAR STDERR:', d.toString()));
        
        p.on('close', (code) => {
            if (code === 0) {
                console.log('Tar success!');
                resolve();
            } else {
                reject(new Error(`Tar failed with code ${code}`));
            }
        });
    });
    
    const tarStats = fs.statSync(tarPath);
    console.log(`Tar Size: ${tarStats.size} bytes`);
    
    console.log('Cleanup...');
    fs.unlinkSync(sqlPath);
    fs.unlinkSync(tarPath);
    console.log('Done!');
}

run().catch(e => {
    console.error('FATAL:', e);
    process.exit(1);
});
