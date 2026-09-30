import { createReadStream } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { withRole } from '@/lib/api-auth';

const BACKUP_DIR = path.join(process.cwd(), 'public', 'backup');
const ALLOWED_BACKUP_NAME =
  /^(?:auto-backup|database|backup-sispatrimonio)-[A-Za-z0-9-]+\.(?:sql|tar\.gz)$/;

export const GET = withRole(['administrador'], async (_request, { params }) => {
  const name = params?.name ?? '';
  if (
    !ALLOWED_BACKUP_NAME.test(name) ||
    path.basename(name) !== name ||
    name.includes('..')
  ) {
    return NextResponse.json({ error: 'Arquivo de backup inválido.' }, { status: 404 });
  }

  const filePath = path.resolve(BACKUP_DIR, name);
  if (path.dirname(filePath) !== path.resolve(BACKUP_DIR)) {
    return NextResponse.json({ error: 'Arquivo de backup inválido.' }, { status: 404 });
  }

  try {
    const fileStats = await lstat(filePath);
    if (!fileStats.isFile() || fileStats.isSymbolicLink()) {
      return NextResponse.json({ error: 'Arquivo de backup não encontrado.' }, { status: 404 });
    }

    const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileStats.size.toString(),
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: 'Arquivo de backup não encontrado.' }, { status: 404 });
    }
    console.error('[BACKUP] Falha ao servir arquivo protegido:', error);
    return NextResponse.json({ error: 'Erro ao ler o backup.' }, { status: 500 });
  }
});
