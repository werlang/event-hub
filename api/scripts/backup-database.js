import { fileURLToPath } from 'node:url';
import { runDatabaseBackup } from '../background/database-backup-task.js';

const __filename = fileURLToPath(import.meta.url);

/**
 * Triggers one database backup run for CLI and deploy usage.
 *
 * @param {{ backupRunner?: typeof runDatabaseBackup, logger?: Pick<Console, 'log'> }} [options]
 * @returns {Promise<object>}
 */
export async function backupDatabase({
    backupRunner = runDatabaseBackup,
    logger = console,
} = {}) {
    const result = await backupRunner();
    if (result?.skipped) {
        logger.log(`Database backup skipped (${result.reason || 'disabled'}).`);
    } else {
        logger.log('Database backup completed successfully.');
    }
    return result;
}

if (process.argv[1] === __filename) {
    backupDatabase().catch(err => {
        console.error('Database backup failed:', err);
        process.exit(1);
    });
}
