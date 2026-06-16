import config from '../config/database-backup.config.js';
import { DatabaseBackupManager } from './database-backup-manager.js';

/**
 * Runs one scheduled database backup through the configured manager.
 */
export async function runDatabaseBackup(options = {}) {
    const manager = new DatabaseBackupManager();
    return manager.run(options);
}

/**
 * Creates a background task for automatic database backups.
 */
export const task = {
    enabled: config.enabled || false,
    rule: config.rule || 'every day at 00:00',
    name: 'database-backup',
    callback: runDatabaseBackup,
};
