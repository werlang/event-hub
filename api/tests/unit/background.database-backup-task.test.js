import { afterEach, describe, expect, jest, test } from '@jest/globals';

describe('background/database-backup-task', () => {
    afterEach(() => {
        jest.resetModules();
        jest.restoreAllMocks();
        delete process.env.DATABASE_BACKUP_ENABLED;
        delete process.env.DATABASE_BACKUP_RULE;
    });

    test('exports disabled daily-midnight task metadata by default', async () => {
        const { task } = await import('../../background/database-backup-task.js');

        expect(task).toMatchObject({
            callback: expect.any(Function),
            enabled: false,
            name: 'database-backup',
            rule: 'every day at 00:00',
        });
    });

    test('runs the database backup manager through the task callback', async () => {
        const run = jest.fn(async options => ({
            ...options,
            skipped: false,
            fileName: 'event_hub_backup_2026-06-15_00-00-00.sql.gz',
        }));

        jest.unstable_mockModule('../../background/database-backup-manager.js', () => ({
            DatabaseBackupManager: class DatabaseBackupManager {
                run(options) {
                    return run(options);
                }
            },
        }));

        const { runDatabaseBackup, task } = await import('../../background/database-backup-task.js');
        const referenceDate = new Date('2026-06-15T00:00:00.000Z');

        await expect(runDatabaseBackup({ referenceDate })).resolves.toEqual({
            referenceDate,
            skipped: false,
            fileName: 'event_hub_backup_2026-06-15_00-00-00.sql.gz',
        });
        await expect(task.callback()).resolves.toEqual({
            skipped: false,
            fileName: 'event_hub_backup_2026-06-15_00-00-00.sql.gz',
        });

        expect(run).toHaveBeenCalledTimes(2);
        expect(run).toHaveBeenNthCalledWith(1, { referenceDate });
        expect(run).toHaveBeenNthCalledWith(2, {});
    });
});
