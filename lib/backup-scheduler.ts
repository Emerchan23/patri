import cron, { ScheduledTask } from 'node-cron';
import { execute, queryOne } from '@/lib/db';
import { generateBackup } from '@/lib/backup-service';
import path from 'path';
import fs from 'fs';

// Store the scheduled task to be able to stop/update it
let backupTask: ScheduledTask | null = null;

interface BackupSettings {
  enabled: number | boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string; // HH:mm
  keep_count: number;
}

const BACKUP_DIR = path.join(process.cwd(), 'public', 'backup');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

export async function initScheduler() {
  console.log('[SCHEDULER] Inicializando agendador de backups...');
  try {
    // Ensure table exists
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

    // Check if settings exist, if not create default
    const count = await queryOne<{ count: number }>("SELECT COUNT(*) as count FROM backup_settings");
    if (count && count.count === 0) {
      await execute("INSERT INTO backup_settings (id, enabled, frequency, time, keep_count) VALUES (1, 0, 'daily', '00:00', 7)");
    }

    // Load settings and schedule
    await reloadSchedule();

  } catch (error) {
    console.error('[SCHEDULER] Erro ao inicializar:', error);
  }
}

export async function reloadSchedule() {
  try {
    const settings = await queryOne<BackupSettings>("SELECT * FROM backup_settings LIMIT 1");
    
    // Stop existing task
    if (backupTask) {
      backupTask.stop();
      backupTask = null;
      console.log('[SCHEDULER] Tarefa anterior parada.');
    }

    if (!settings || !settings.enabled) {
      console.log('[SCHEDULER] Backup automático desativado.');
      return;
    }

    // Parse time
    const [hour, minute] = settings.time.split(':');
    
    // Construct cron expression
    let cronExpression = '';
    
    switch (settings.frequency) {
      case 'daily':
        cronExpression = `${minute} ${hour} * * *`;
        break;
      case 'weekly':
        // Every Monday
        cronExpression = `${minute} ${hour} * * 1`;
        break;
      case 'monthly':
        // 1st of month
        cronExpression = `${minute} ${hour} 1 * *`;
        break;
      default:
        cronExpression = `${minute} ${hour} * * *`;
    }

    console.log(`[SCHEDULER] Agendando backup: ${settings.frequency} às ${settings.time} (${cronExpression})`);
    console.log(`[SCHEDULER] Hora atual do servidor: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (Brasília)`);

    backupTask = cron.schedule(cronExpression, async () => {
      console.log('[SCHEDULER] Executando backup automático...');
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `auto-backup-${timestamp}.sql`;
        
        await generateBackup(
            path.join(BACKUP_DIR, filename),
            { type: 'db' }
        );
        console.log(`[SCHEDULER] Backup realizado com sucesso: ${filename}`);
        
        // Clean old backups
        await cleanOldBackups(settings.keep_count);
      } catch (error) {
        console.error('[SCHEDULER] Erro ao executar backup automático:', error);
      }
    }, {
      timezone: "America/Sao_Paulo"
    });

  } catch (error) {
    console.error('[SCHEDULER] Erro ao recarregar agendamento:', error);
  }
}

async function cleanOldBackups(keepCount: number) {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('auto-backup-') && f.endsWith('.sql'))
      .map(f => ({
        name: f,
        time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // Newest first

    if (files.length > keepCount) {
      const toDelete = files.slice(keepCount);
      for (const file of toDelete) {
        fs.unlinkSync(path.join(BACKUP_DIR, file.name));
        console.log(`[SCHEDULER] Backup antigo removido: ${file.name}`);
      }
    }
  } catch (error) {
    console.error('[SCHEDULER] Erro ao limpar backups antigos:', error);
  }
}
