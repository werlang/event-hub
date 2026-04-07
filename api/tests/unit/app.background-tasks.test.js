import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { BackgroundTask } from '../../background/background-task.js';
import { BACKGROUND_TASK_FILES, startBackgroundTasks } from '../../app.js';

describe('app background tasks', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('the runtime registers the weekly digest task instead of the placeholder task list', async () => {
        const task = new BackgroundTask('every sunday at 18:00', async () => {}, {
            environment: 'test',
            logger: {
                info() {},
                warn() {},
                error() {},
            },
            name: 'weekly-email-digest',
        });
        task.start = jest.fn(() => task);

        const taskLoader = jest.fn(async (file) => {
            if (file === 'weekly-digest-task') {
                return { task };
            }

            return { task: {} };
        });
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        const startedTasks = await startBackgroundTasks(['weekly-digest-task', 'invalid-task'], taskLoader);

        expect(BACKGROUND_TASK_FILES).toEqual(['weekly-digest-task']);
        expect(taskLoader).toHaveBeenCalledTimes(2);
        expect(task.start).toHaveBeenCalledTimes(1);
        expect(startedTasks).toEqual([task]);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('invalid-task'));
    });
});