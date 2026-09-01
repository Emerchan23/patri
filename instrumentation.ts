export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
        const { initScheduler } = await import('./lib/backup-scheduler');
        await initScheduler();
    } catch (e) {
        console.error('Failed to initialize backup scheduler:', e);
    }
  }
}
