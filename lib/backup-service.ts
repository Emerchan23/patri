import { spawn } from 'child_process';
import { createWriteStream, existsSync, mkdirSync, statSync } from 'fs';
import * as fs from 'fs';
import { unlink, rm } from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';

import { queryOne } from '@/lib/db';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'db',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'sispatrimonio',
};

interface BackupResult {
  path: string;
  filename: string;
  size: number;
}

// Function to dump database to a specific file
function dumpDatabase(outputPath: string, timeoutMs = 300000): Promise<void> { // Increased to 5 minutes
    return new Promise(async (resolve, reject) => {
        
        // 1. HEALTH CHECK: Verify if we are connected to the CORRECT database before dumping
        try {
            // Check for a known table that MUST exist in the current version.
            // We prefer newer structures first so backup/restore validates the evolved schema.
            const check =
                await queryOne("SELECT 1 FROM etiquetas_provisorias_lotes LIMIT 1").catch(() => null) ||
                await queryOne("SELECT 1 FROM etiquetas_provisorias LIMIT 1").catch(() => null) ||
                await queryOne("SELECT 1 FROM departamentos_assistente LIMIT 1").catch(() => null);
            if (!check) {
                 await queryOne("SELECT 1 FROM bens LIMIT 1");
            }
            console.log('[BACKUP] Verificação de integridade do banco: OK');
        } catch (error) {
            console.error('[BACKUP] ERRO CRÍTICO: Tentativa de backup de banco de dados INVÁLIDO ou VAZIO.', error);
            reject(new Error("ABORTADO: O sistema não conseguiu verificar a integridade do banco de dados. Verifique a conexão."));
            return;
        }

        const baseOptions = [
            '--single-transaction',
            '--quick',
            '--lock-tables=false',
            '--add-drop-table',
            '--no-tablespaces',
            '--complete-insert', // Important: Ensures full insert statements
            '--extended-insert', // Faster and standard
            '--hex-blob',        // CRITICAL for binary data/images
            '--disable-keys'     // Disable keys during restore for speed and to avoid errors
        ];

        // Try extended options first (might fail on permissions)
        const extendedOptions = [
            ...baseOptions,
            '--routines',
            '--events',
            '--triggers'
        ];

        const runDump = (options: string[], attemptType: string) => {
            return new Promise<void>((res, rej) => {
                const writeStream = createWriteStream(outputPath);
                const controller = new AbortController();
                const { signal } = controller;
                const timeout = setTimeout(() => {
                    controller.abort();
                    rej(new Error(`Timeout de ${timeoutMs}ms excedido ao gerar dump.`));
                }, timeoutMs);

                console.log(`[BACKUP] Executando mysqldump (${attemptType})...`);

                const mysqldump = spawn('mysqldump', [
                    `-h${DB_CONFIG.host}`,
                    `-u${DB_CONFIG.user}`,
                    `-p${DB_CONFIG.password}`,
                    ...options,
                    '--skip-ssl',
                    '--protocol=tcp',
                    DB_CONFIG.database
                ], { signal });

                mysqldump.stdout.pipe(writeStream);
                
                let stderr = '';
                mysqldump.stderr.on('data', d => stderr += d.toString());

                const processPromise = new Promise<number>((resolveProc) => {
                    mysqldump.on('close', (code) => resolveProc(code || 0));
                    mysqldump.on('error', (err) => {
                        console.error(`[BACKUP] Erro no processo mysqldump:`, err);
                        // If process errors, we resolve with non-zero to fail later
                        resolveProc(1);
                    });
                });

                const streamPromise = new Promise<void>((resolveStream, rejectStream) => {
                    writeStream.on('finish', resolveStream);
                    writeStream.on('error', rejectStream);
                });

                Promise.all([processPromise, streamPromise])
                    .then(([code]) => {
                        clearTimeout(timeout);
                        if (code === 0) {
                            if (existsSync(outputPath) && statSync(outputPath).size > 0) {
                                console.log(`[BACKUP] Dump (${attemptType}) concluído com sucesso.`);
                                res();
                            } else {
                                const msg = `Arquivo de dump vazio ou inexistente.`;
                                console.error(`[BACKUP] ${msg}`);
                                rej(new Error(msg));
                            }
                        } else {
                            const errorMsg = `Exit code ${code}. Stderr: ${stderr}`;
                            console.error(`[BACKUP] Falha no dump (${attemptType}):`, errorMsg);
                            rej(new Error(errorMsg));
                        }
                    })
                    .catch((err) => {
                        clearTimeout(timeout);
                        // Ensure stream is destroyed
                        writeStream.destroy();
                        console.error(`[BACKUP] Erro geral no dump (${attemptType}):`, err);
                        rej(err);
                    });
            });
        };

        runDump(extendedOptions, 'completo')
            .then(resolve)
            .catch((err) => {
                console.warn('[BACKUP] Falha no dump completo, tentando simples:', err.message);
                runDump(baseOptions, 'simples').then(resolve).catch(reject);
            });
    });
}

// Function to create tar.gz archive
function createArchive(outputTarPath: string, sqlPath: string, uploadsPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const sqlDir = path.dirname(sqlPath);
        const sqlFile = path.basename(sqlPath);
        const uploadsDir = path.dirname(uploadsPath); // e.g. /app/public
        const uploadsBase = path.basename(uploadsPath); // e.g. uploads

        // Check if uploads exists
        const hasUploads = existsSync(uploadsPath);
        
        // We output tar to a completely temporary file FIRST, then move it to final location
        // This avoids "file is the archive" error when writing to the same dir we are reading from (even partially)
        const tempTarPath = path.join(os.tmpdir(), path.basename(outputTarPath));
        
        const args = ['-czf', tempTarPath];
        
        // Add SQL file
        args.push('-C', sqlDir, sqlFile);
        
        // Add uploads if exists
        if (hasUploads) {
             args.push('-C', uploadsDir, uploadsBase);
        }
        
        console.log(`[BACKUP] Criando arquivo tar temporário: ${tempTarPath}`);
        console.log(`[BACKUP] Args: ${args.join(' ')}`);

        const tar = spawn('tar', args);

        let stderr = '';
        tar.stderr.on('data', d => stderr += d.toString());

        tar.on('close', async (code) => {
            if (code === 0) {
                // Move temp file to final destination
                try {
                    await fs.promises.copyFile(tempTarPath, outputTarPath);
                    await fs.promises.unlink(tempTarPath);
                    resolve();
                } catch (e) {
                    reject(e);
                }
            } else {
                // Ignore "file changed as we read it" (exit code 1) which is common for live logs/uploads
                if (code === 1) {
                     console.warn(`[BACKUP] Tar warning (code 1): ${stderr}`);
                     try {
                        await fs.promises.copyFile(tempTarPath, outputTarPath);
                        await fs.promises.unlink(tempTarPath);
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                } else {
                    reject(new Error(`Tar failed with code ${code}: ${stderr}`));
                }
            }
        });

        tar.on('error', reject);
    });
}

export async function generateBackup(targetPath?: string, options: { type: 'full' | 'db' } = { type: 'full' }): Promise<BackupResult> {
  // CRITICAL: Use the mounted volume path '/app/public/backup' provided by the user
  // This ensures we have write permissions and persistence if needed
  const backupDir = path.join(process.cwd(), 'public', 'backup');
  
  // Ensure the directory exists (it should be mounted, but mkdir -p is safe)
  if (!existsSync(backupDir)) {
      try {
        mkdirSync(backupDir, { recursive: true });
      } catch (e) {
        console.error(`[BACKUP] Failed to create backup dir at ${backupDir}`, e);
        // Fallback to temp if mount fails, though unlikely
      }
  }

  const backupId = randomUUID().slice(0, 8);
  const dateStr = new Date().toISOString().slice(0, 10);
  
  const sqlFilename = `database-${dateStr}-${backupId}.sql`;
  // Save SQL in the backup folder
  const sqlPath = targetPath && options.type === 'db' ? targetPath : path.join(backupDir, sqlFilename);
  
  const tarFilename = `backup-sispatrimonio-${dateStr}-${backupId}.tar.gz`;
  // Save TAR in the backup folder
  const finalPath = targetPath && options.type === 'full' ? targetPath : path.join(backupDir, tarFilename);
  
  // Ensure target directory exists if provided manually
  if (targetPath) {
    const dir = path.dirname(targetPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  try {
    console.log(`[BACKUP] Gerando backup em VOLUME MONTADO...`);
    console.log(`[BACKUP] SQL Path: ${sqlPath}`);
    console.log(`[BACKUP] Final Path: ${finalPath}`);
    
    // 1. Generate SQL Dump
    await dumpDatabase(sqlPath);

    // If only DB requested, return the SQL file
    if (options.type === 'db') {
        const stats = statSync(sqlPath);
        return {
            path: sqlPath,
            filename: path.basename(sqlPath),
            size: stats.size
        };
    }

    // 2. Archive SQL + Uploads (Full Backup)
    // IMPORTANT: Use the mounted volume path if available, or fallback to default
    // In Docker Compose, '/app/public/uploads' is mapped to host volume
    const uploadsPath = process.env.UPLOADS_PATH || path.join(process.cwd(), 'public', 'uploads');
    
    await createArchive(finalPath, sqlPath, uploadsPath);

    // 3. Cleanup SQL (since it's now in the archive)
    try { 
        if (sqlPath !== finalPath && existsSync(sqlPath)) {
            await unlink(sqlPath); 
        }
    } catch (e) {}

    // 4. Verify result
    const stats = statSync(finalPath);
    if (stats.size === 0) {
        throw new Error('Backup file is empty');
    }

    return {
        path: finalPath,
        filename: path.basename(finalPath),
        size: stats.size
    };

  } catch (error: any) {
    console.error('[BACKUP] Erro fatal:', error);
    // Cleanup
    try { if (existsSync(sqlPath) && options.type !== 'db') await unlink(sqlPath); } catch (e) {}
    try { if (existsSync(finalPath) && finalPath !== sqlPath) await unlink(finalPath); } catch (e) {}
    throw error;
  }
}

export async function getBackupStream(): Promise<{ stream: ReadableStream, filename: string }> {
  // Use the mounted volume for backup operations
  const backupDir = path.join(process.cwd(), 'public', 'backup');
  if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
  }

  const backupId = randomUUID().slice(0, 8);
  const dateStr = new Date().toISOString().slice(0, 10);
  const tarFilename = `backup-sispatrimonio-${dateStr}-${backupId}.tar.gz`;
  const targetPath = path.join(backupDir, tarFilename);

  console.log(`[BACKUP-STREAM] Iniciando geração de backup em: ${targetPath}`);

  // 1. Generate full backup FILE on disk first (Reliable)
  // Pass targetPath to ensure it is saved in our controlled temp dir
  const result = await generateBackup(targetPath, { type: 'full' });
  
  // 2. Create stream from the generated file
  const fileStream = fs.createReadStream(result.path);
  
  // Create a Web ReadableStream
  const stream = new ReadableStream({
    start(controller) {
        fileStream.on('data', chunk => controller.enqueue(chunk));
        
        fileStream.on('end', () => {
            // controller.close() might be called automatically by some adapters, but good to be explicit
            try { controller.close(); } catch(e) {}
            
            console.log('[BACKUP-STREAM] Stream finalizado com sucesso.');
            // Cleanup after successful stream (give it some time to be flushed)
            setTimeout(() => {
                unlink(result.path).catch(() => console.warn('Failed to delete temp backup:', result.path));
            }, 10000); 
        });
        
        fileStream.on('error', err => {
            controller.error(err);
            console.error('[BACKUP-STREAM] Erro no stream do arquivo:', err);
            unlink(result.path).catch(() => {});
        });
    },
    cancel() {
        console.log('[BACKUP-STREAM] Cancelado pelo cliente.');
        fileStream.destroy();
        unlink(result.path).catch(() => {});
    }
  });

  return { stream, filename: result.filename };
}
