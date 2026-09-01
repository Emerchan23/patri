
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import fs from 'fs';
import path from 'path';

const BACKUP_DIR = path.join(process.cwd(), 'public', 'backup');

export const GET = withAuth(async () => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return NextResponse.json([]);
    }

    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.sql'))
      .map(f => {
        const stats = fs.statSync(path.join(BACKUP_DIR, f));
        return {
          name: f,
          size: stats.size,
          created_at: stats.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json(files);
  } catch (error: any) {
    console.error('Erro ao listar backups:', error);
    return NextResponse.json({ error: 'Erro ao listar backups' }, { status: 500 });
  }
});
