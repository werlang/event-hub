import { describe, expect, jest, test } from '@jest/globals';
import { backupDatabase } from '../../scripts/backup-database.js';

describe('scripts/backup-database', () => {
    test('runs backup and logs completion when enabled', async () => {
        const backupRunner = jest.fn().mockResolvedValue({
            skipped: false,
            fileName: 'event_hub_backup_2026-11-19.sql.gz',
        });
        const logger = { log: jest.fn() };

        const result = await backupDatabase({ backupRunner, logger });

        expect(backupRunner).toHaveBeenCalledTimes(1);
        expect(logger.log).toHaveBeenCalledWith('Database backup completed successfully.');
        expect(result).toEqual({
            skipped: false,
            fileName: 'event_hub_backup_2026-11-19.sql.gz',
        });
    });

    test('logs skip reason when database backups are disabled', async () => {
        const backupRunner = jest.fn().mockResolvedValue({
            skipped: true,
            reason: 'disabled',
        });
        const logger = { log: jest.fn() };

        const result = await backupDatabase({ backupRunner, logger });

        expect(backupRunner).toHaveBeenCalledTimes(1);
        expect(logger.log).toHaveBeenCalledWith('Database backup skipped (disabled).');
        expect(result).toEqual({ skipped: true, reason: 'disabled' });
    });

    test('propagates backup errors so deploy aborts before migrations', async () => {
        const backupRunner = jest.fn().mockRejectedValue(new Error('GCS upload failed'));
        const logger = { log: jest.fn() };

        await expect(backupDatabase({ backupRunner, logger })).rejects.toThrow('GCS upload failed');
        expect(logger.log).not.toHaveBeenCalled();
    });
});
