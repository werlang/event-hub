import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { task as databaseBackupTask } from '../../background/database-backup-task.js';
import { task as weeklyDigestTask } from '../../background/weekly-digest-task.js';
import { BACKGROUND_TASK_FILES, startBackgroundTasks } from '../../app.js';

describe('app background tasks', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('the runtime registers the recurring task files and skips disabled task configs', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const startedTasks = await startBackgroundTasks(BACKGROUND_TASK_FILES);

        expect(BACKGROUND_TASK_FILES).toEqual(['weekly-digest-task', 'database-backup-task']);
        expect(weeklyDigestTask.enabled).toBe(false);
        expect(databaseBackupTask.enabled).toBe(false);
        expect(startedTasks).toEqual([]);
        expect(warnSpy).toHaveBeenCalledWith('Task "weekly-digest-task" is disabled. Skipping.');
        expect(warnSpy).toHaveBeenCalledWith('Task "database-backup-task" is disabled. Skipping.');
    });

    test('weekly digest task exports the configured scheduling metadata instead of a started instance', async () => {
        expect(weeklyDigestTask).toMatchObject({
            callback: expect.any(Function),
            enabled: false,
            name: 'weekly-email-digest',
            rule: expect.any(String),
        });
    });

    test('database backup task exports the configured scheduling metadata instead of a started instance', async () => {
        expect(databaseBackupTask).toMatchObject({
            callback: expect.any(Function),
            enabled: false,
            name: 'database-backup',
            rule: 'every day at 00:00',
        });
    });

    test('startBackgroundTasks ignores invalid non-string task entries with a warning', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const startedTasks = await startBackgroundTasks([null]);

        expect(startedTasks).toEqual([]);
        expect(warnSpy).toHaveBeenCalledWith('Invalid task file "null". Skipping.');
    });

    test('startBackgroundTasks warns and skips missing task modules instead of crashing startup', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const startedTasks = await startBackgroundTasks(['invalid-task']);

        expect(startedTasks).toEqual([]);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to load task "invalid-task". Skipping.'));
    });
});
