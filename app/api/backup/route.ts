
import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { createWriteStream, createReadStream, statSync } from 'fs';
import { unlink } from 'fs/promises';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';

export async function GET() {
  const host = process.env.DB_HOST || 'db';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || 'root';
  const database = process.env.DB_NAME || 'sispatrimonio';
  
  const tempPath = path.join(os.tmpdir(), `backup-${randomUUID()}.sql`);
  let stderrOutput = '';
  
  try {
    const writeStream = createWriteStream(tempPath);

    console.log(`[BACKUP] Iniciando mysqldump em ${host}...`);

    // Adicionado timeout de 60 segundos
    const controller = new AbortController();
    const { signal } = controller;
    const timeout = setTimeout(() => {
        controller.abort();
    }, 60000);

    const mysqldump = spawn('mysqldump', [
        `-h${host}`,
        `-u${user}`,
        `-p${password}`,
        '--single-transaction',
        '--quick',
        '--lock-tables=false',
        '--skip-ssl',
        '--protocol=tcp', // Força TCP para evitar problemas de socket
        database
    ], { signal });

    mysqldump.stdout.pipe(writeStream);

    mysqldump.stderr.on('data', (data) => {
        const msg = data.toString();
        console.error(`mysqldump stderr: ${msg}`);
        stderrOutput += msg;
    });

    const exitCode = await new Promise((resolve, reject) => {
        mysqldump.on('close', (code) => {
            clearTimeout(timeout);
            resolve(code);
        });
        mysqldump.on('error', (err) => {
            clearTimeout(timeout);
            if (err.name === 'AbortError') {
                console.error('Backup process timed out');
                stderrOutput += 'Backup timed out after 60s';
                resolve(-3);
            } else {
                console.error('Failed to start mysqldump', err);
                stderrOutput += `Failed to start: ${err.message}`;
                resolve(-1);
            }
        });
        writeStream.on('error', (err) => {
            clearTimeout(timeout);
            console.error('Failed to write backup file', err);
            stderrOutput += `Write error: ${err.message}`;
            resolve(-2);
        });
    });

    if (exitCode !== 0) {
        console.error(`[BACKUP] Falha com código: ${exitCode}`);
        // Tenta limpar o arquivo temporário se falhou
        try { await unlink(tempPath); } catch (e) {}
        
        return NextResponse.json(
            { error: `Erro ao gerar backup. Código: ${exitCode}. Detalhes: ${stderrOutput}` }, 
            { status: 500 }
        );
    }
    
    // Wait for write stream to finish properly
    await new Promise<void>((resolve) => writeStream.on('finish', () => resolve()));

    const stats = statSync(tempPath);
    const fileSize = stats.size;
    console.log(`[BACKUP] Arquivo gerado: ${fileSize} bytes`);

    if (fileSize === 0) {
        try { await unlink(tempPath); } catch (e) {}
        return NextResponse.json({ error: `Backup gerado vazio. Detalhes: ${stderrOutput}` }, { status: 500 });
    }

    const stream = new ReadableStream({
        start(controller) {
            const reader = createReadStream(tempPath);
            reader.on('data', (chunk) => controller.enqueue(chunk));
            reader.on('end', () => {
                controller.close();
                unlink(tempPath).catch(console.error); // Clean up on success
            });
            reader.on('error', (err) => {
                controller.error(err);
                unlink(tempPath).catch(console.error); // Clean up on error
            });
        },
        cancel() {
            unlink(tempPath).catch(console.error); // Clean up on cancel
        }
    });

    const filename = `backup-sispatrimonio-${new Date().toISOString().slice(0, 10)}.sql`;

    return new NextResponse(stream, {
        headers: {
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': 'application/sql',
        'Content-Length': fileSize.toString(),
        },
    });

  } catch (error) {
    console.error('[BACKUP] Erro fatal:', error);
    // Try to cleanup
    if (tempPath) unlink(tempPath).catch(() => {});
    return NextResponse.json(
        { error: 'Erro interno ao gerar backup: ' + (error as any).message }, 
        { status: 500 }
    );
  }
}
