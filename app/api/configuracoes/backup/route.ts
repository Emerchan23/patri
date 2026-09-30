import { NextResponse } from 'next/server';
import { execute, query, queryOne } from '@/lib/db';
import { withRole } from '@/lib/api-auth';
import { reloadSchedule } from '@/lib/backup-scheduler';

const REQUIRED_COLUMNS = ['id', 'enabled', 'frequency', 'time', 'keep_count'];

async function hasBackupSettingsSchema() {
  const rows = await query<{ COLUMN_NAME: string }>(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    ['backup_settings'],
  );
  const columns = new Set(rows.map((row) => row.COLUMN_NAME.toLowerCase()));
  return REQUIRED_COLUMNS.every((column) => columns.has(column));
}

function schemaUnavailable() {
  return NextResponse.json(
    { error: 'A configuração de backups não está instalada neste banco.' },
    { status: 409 },
  );
}

export const GET = withRole(['administrador'], async () => {
  if (!(await hasBackupSettingsSchema())) return schemaUnavailable();

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

export const PUT = withRole(['administrador'], async (request) => {
  if (!(await hasBackupSettingsSchema())) return schemaUnavailable();

  let body: Record<string, unknown>;
  try {
    const payload: unknown = await request.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return NextResponse.json({ error: 'Corpo da solicitação inválido.' }, { status: 400 });
    }
    body = payload as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const validFrequency = ['daily', 'weekly', 'monthly'].includes(
    String(body.frequency),
  );
  const validTime =
    typeof body.time === 'string' &&
    /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(body.time);
  const validKeepCount =
    Number.isInteger(body.keep_count) &&
    Number(body.keep_count) >= 1 &&
    Number(body.keep_count) <= 30;

  if (
    typeof body.enabled !== 'boolean' ||
    !validFrequency ||
    !validTime ||
    !validKeepCount
  ) {
    return NextResponse.json(
      {
        error:
          'Informe enabled booleano, frequência diária/semanal/mensal, horário HH:mm e retenção entre 1 e 30 backups.',
      },
      { status: 400 },
    );
  }

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
