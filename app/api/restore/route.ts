
import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import os from 'os';

export async function POST(request: NextRequest) {
  let tempPath = '';
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    tempPath = path.join(os.tmpdir(), `restore-${randomUUID()}.sql`);

    await writeFile(tempPath, buffer);

    const host = process.env.DB_HOST || 'db';
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || 'root';
    const database = process.env.DB_NAME || 'sispatrimonio';

    console.log(`[RESTORE] Iniciando restauracao do arquivo ${tempPath} em ${host}/${database}`);

    const mysql = spawn('mysql', [
      `-h${host}`,
      `-u${user}`,
      `-p${password}`,
      '--skip-ssl',
      database
    ]);

    const fileStream = createReadStream(tempPath);
    fileStream.pipe(mysql.stdin);

    const exitCode = await new Promise<number>((resolve, reject) => {
      mysql.on('close', (code) => {
        resolve(code ?? 1);
      });
      mysql.on('error', (err) => {
        reject(err);
      });
      mysql.stderr.on('data', (data) => {
        console.error(`mysql stderr: ${data}`);
      });
    });

    if (exitCode === 0) {
      return NextResponse.json({ success: true, message: 'Restauração concluída com sucesso!' });
    } else {
      return NextResponse.json(
        { error: `Falha na restauração. Código de saída: ${exitCode}` },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Erro no processo de restore:', error);
    return NextResponse.json(
      { error: 'Erro interno ao processar restauração: ' + (error as Error).message },
      { status: 500 }
    );
  } finally {
    if (tempPath) {
      try {
        await unlink(tempPath);
      } catch (e) {
        console.error('Erro ao limpar arquivo temporario', e);
      }
    }
  }
}
