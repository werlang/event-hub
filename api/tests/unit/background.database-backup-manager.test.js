import { describe, expect, jest, test } from '@jest/globals';
import { DatabaseBackupManager } from '../../background/database-backup-manager.js';

function buildConfig(overrides = {}) {
    return {
        enabled: true,
        projectId: 'agenda-project',
        bucket: 'agenda-backups',
        storageDir: 'database_backup',
        accountFile: 'database-backup-credentials.json',
        credentialsPath: '/app/config/database-backup-credentials.json',
        ...overrides,
    };
}

function buildManager(overrides = {}) {
    const upload = overrides.upload || jest.fn(async () => 'https://storage.local/media-link');
    const fileSystem = overrides.fileSystem || { unlink: jest.fn(async () => undefined) };
    const manager = new DatabaseBackupManager({
        backupConfig: buildConfig(overrides.backupConfig),
        mysql: overrides.mysql || { dump: jest.fn(async () => undefined) },
        compress: overrides.compress || jest.fn(async () => undefined),
        storageFactory: overrides.storageFactory || jest.fn(() => ({ upload })),
        fileSystem,
        fileChecks: overrides.fileChecks || { existsSync: jest.fn(() => true) },
        tempDir: overrides.tempDir || (() => '/tmp'),
        now: overrides.now || (() => new Date('2026-06-15T00:00:00.000Z')),
    });

    return {
        manager,
        upload,
        fileSystem,
    };
}

describe('background/database-backup-manager', () => {
    test('disabled config is a no-op before validating credentials or dumping', async () => {
        const mysql = { dump: jest.fn() };
        const fileChecks = { existsSync: jest.fn() };
        const { manager } = buildManager({
            backupConfig: { enabled: false },
            mysql,
            fileChecks,
        });

        await expect(manager.run()).resolves.toEqual({
            skipped: true,
            reason: 'disabled',
        });

        expect(fileChecks.existsSync).not.toHaveBeenCalled();
        expect(mysql.dump).not.toHaveBeenCalled();
    });

    test('missing required GCS config fails before dumping', async () => {
        const mysql = { dump: jest.fn() };
        const { manager } = buildManager({
            backupConfig: {
                projectId: '',
                bucket: '',
            },
            mysql,
        });

        await expect(manager.run()).rejects.toThrow('DATABASE_BACKUP_GCLOUD_PROJECT_ID, DATABASE_BACKUP_GCLOUD_BUCKET');
        expect(mysql.dump).not.toHaveBeenCalled();
    });

    test('missing credentials file fails before dumping', async () => {
        const mysql = { dump: jest.fn() };
        const { manager } = buildManager({
            fileChecks: { existsSync: jest.fn(() => false) },
            mysql,
        });

        await expect(manager.run()).rejects.toThrow('/app/config/database-backup-credentials.json');
        expect(mysql.dump).not.toHaveBeenCalled();
    });

    test('successful run dumps, compresses, uploads, and removes temporary files', async () => {
        const mysql = { dump: jest.fn(async () => undefined) };
        const compress = jest.fn(async () => undefined);
        const storageFactory = jest.fn(() => ({
            upload: jest.fn(async () => 'https://storage.local/media-link'),
        }));
        const fileSystem = { unlink: jest.fn(async () => undefined) };
        const { manager } = buildManager({
            mysql,
            compress,
            storageFactory,
            fileSystem,
        });

        await expect(manager.run()).resolves.toEqual({
            skipped: false,
            fileName: 'event_hub_backup_2026-06-15_00-00-00.sql.gz',
            mediaLink: 'https://storage.local/media-link',
        });

        expect(mysql.dump).toHaveBeenCalledWith('/tmp/event_hub_backup_2026-06-15_00-00-00.sql');
        expect(compress).toHaveBeenCalledWith(
            '/tmp/event_hub_backup_2026-06-15_00-00-00.sql',
            '/tmp/event_hub_backup_2026-06-15_00-00-00.sql.gz',
        );
        expect(storageFactory).toHaveBeenCalledWith({
            projectId: 'agenda-project',
            keyFilename: '/app/config/database-backup-credentials.json',
        });
        expect(storageFactory.mock.results[0].value.upload).toHaveBeenCalledWith({
            srcFilePath: '/tmp/event_hub_backup_2026-06-15_00-00-00.sql.gz',
            bucket: 'agenda-backups',
            storageDir: 'database_backup',
            fileName: 'event_hub_backup_2026-06-15_00-00-00.sql.gz',
        });
        expect(fileSystem.unlink).toHaveBeenCalledWith('/tmp/event_hub_backup_2026-06-15_00-00-00.sql');
        expect(fileSystem.unlink).toHaveBeenCalledWith('/tmp/event_hub_backup_2026-06-15_00-00-00.sql.gz');
    });

    test('upload failure still removes temporary files and propagates the error', async () => {
        const fileSystem = { unlink: jest.fn(async () => undefined) };
        const uploadError = new Error('upload failed');
        const { manager } = buildManager({
            fileSystem,
            storageFactory: jest.fn(() => ({
                upload: jest.fn(async () => {
                    throw uploadError;
                }),
            })),
        });

        await expect(manager.run()).rejects.toThrow('upload failed');
        expect(fileSystem.unlink).toHaveBeenCalledWith('/tmp/event_hub_backup_2026-06-15_00-00-00.sql');
        expect(fileSystem.unlink).toHaveBeenCalledWith('/tmp/event_hub_backup_2026-06-15_00-00-00.sql.gz');
    });

    test('missing temporary files are ignored during cleanup', async () => {
        const fileSystem = {
            unlink: jest.fn(async () => {
                const error = new Error('missing');
                error.code = 'ENOENT';
                throw error;
            }),
        };
        const { manager } = buildManager({ fileSystem });

        await expect(manager.run()).resolves.toMatchObject({
            skipped: false,
        });
        expect(fileSystem.unlink).toHaveBeenCalledTimes(2);
    });
});
