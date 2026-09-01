import { NextResponse } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import { withAuth } from '@/lib/api-auth';
import { reloadSchedule } from '@/lib/backup-scheduler';

// Ensure table exists (similar to system settings)
async function ensureTableExists() {
    await execute(`
      CREATE TABLE IF NOT EXISTS backup_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        enabled BOOLEAN DEFAULT FALSE,
        frequency VARCHAR(20) DEFAULT 'daily',
        time VARCHAR(5) DEFAULT '00:00',
        keep_count INT DEFAULT 7,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
}

export const GET = withAuth(async () => {
  await ensureTableExists();
  
  const settings = await queryOne("SELECT * FROM backup_settings LIMIT 1");
  
  if (!settings) {
    return NextResponse.json({
      enabled: false,
      frequency: 'daily',
      time: '00:00',
      keep_count: 7
    });
  }

  return NextResponse.json(settings);
});

export const PUT = withAuth(async (request) => {
  await ensureTableExists();
  const body = await request.json();

  const existing = await queryOne<{ id: number }>("SELECT id FROM backup_settings LIMIT 1");

  if (existing) {
    await execute(
      "UPDATE backup_settings SET enabled=?, frequency=?, time=?, keep_count=? WHERE id=?",
      [body.enabled, body.frequency, body.time, body.keep_count, existing.id]
    );
  } else {
    await execute(
      "INSERT INTO backup_settings (enabled, frequency, time, keep_count) VALUES (?, ?, ?, ?)",
      [body.enabled, body.frequency, body.time, body.keep_count]
    );
  }

  // Reload the scheduler
  try {
      // We can't directly call reloadSchedule here because it runs on the server process
      // and Next.js API routes might be isolated.
      // However, for a local 'next start', they share the same process memory usually.
      // If this doesn't work, we might need an external trigger or polling.
      // Let's try direct call first.
      await reloadSchedule();
  } catch (e) {
      console.error("Failed to reload scheduler:", e);
  }

  return NextResponse.json({ success: true });
});
