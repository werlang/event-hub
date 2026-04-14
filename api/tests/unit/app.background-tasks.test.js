import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { task as weeklyDigestTask } from '../../background/weekly-digest-task.js';
import { BACKGROUND_TASK_FILES, startBackgroundTasks } from '../../app.js';

describe('app background tasks', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('the runtime registers only the weekly digest task file and skips disabled task configs', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const startedTasks = await startBackgroundTasks(['weekly-digest-task']);

        expect(BACKGROUND_TASK_FILES).toEqual(['weekly-digest-task']);
        expect(weeklyDigestTask.enabled).toBe(false);
        expect(startedTasks).toEqual([]);
        expect(warnSpy).toHaveBeenCalledWith('Task "weekly-digest-task" is disabled. Skipping.');
    });

    test('weekly digest task exports the configured scheduling metadata instead of a started instance', async () => {
        expect(weeklyDigestTask).toMatchObject({
            callback: expect.any(Function),
            enabled: false,
            name: 'weekly-email-digest',
            rule: expect.any(String),
        });
    });

    test('startBackgroundTasks ignores invalid non-string task entries with a warning', async () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const startedTasks = await startBackgroundTasks([null]);

        expect(startedTasks).toEqual([]);
        expect(warnSpy).toHaveBeenCalledWith('Invalid task file "null". Skipping.');
    });
});