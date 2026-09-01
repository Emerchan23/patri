import { NextResponse } from 'next/server';
import { generateBackup } from '@/lib/backup-service';
import { readFile, unlink } from 'fs/promises';
import { withRole } from '@/lib/api-auth';

// Use Edge Runtime or Nodejs, but we need spawn, so Nodejs.
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

export const GET = withRole(["administrador"], async () => {
  let backupPath = '';
  try {
    // Generate the file on disk first
    const result = await generateBackup(undefined, { type: 'full' });
    backupPath = result.path;
    
    // Read file into buffer (safer than stream for small/medium files)
    const fileBuffer = await readFile(backupPath);
    
    // Delete temp file ONLY IF it's not in the persistent backup folder
    // But since we are now using the persistent folder, we might want to keep it?
    // User requested download, usually implies temporary file for download.
    // However, if we keep it, it fills up disk. Let's delete after download for now.
    // OR: check if auto-backup logic handles retention.
    
    // For manual download, we usually delete after serving to save space, 
    // unless the user wants a history. The "Baixar Backup" button implies "Give me the file".
    // We will delete it to be safe and save space, as the user has the copy.
    await unlink(backupPath).catch(e => console.warn('Failed to cleanup backup:', e));
    
    return new NextResponse(fileBuffer, {
        headers: {
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Content-Type': 'application/gzip',
        'Content-Length': result.size.toString(),
        },
    });

  } catch (error: any) {
    console.error('[BACKUP] Erro fatal:', error);
    // Try to cleanup if path exists
    if (backupPath) {
        try { await unlink(backupPath); } catch(e) {}
    }
    
    return NextResponse.json(
        { error: "Erro interno ao gerar backup" }, 
        { status: 500 }
    );
  }
})
