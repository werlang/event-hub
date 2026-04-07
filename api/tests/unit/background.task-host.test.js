import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { BackgroundTaskHost } from '../../background/task-host.js';

describe('background/task-host', () => {
    let logger;

    beforeEach(() => {
        jest.useFakeTimers();
        logger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('registerTask stores metadata and start schedules recurring production callbacks', async () => {
        const callback = jest.fn().mockResolvedValue(undefined);
        const host = new BackgroundTaskHost({ environment: 'production', logger });

        const registeredTask = host.registerTask({
            name: 'sync-approved-events',
            callback,
            timer: { intervalMs: 1000 },
        });

        host.start();
        await jest.advanceTimersByTimeAsync(3000);

        expect(registeredTask).toEqual({
            name: 'sync-approved-events',
            timer: {
                intervalMs: 1000,
                initialDelayMs: 1000,
            },
        });
        expect(host.getRegisteredTasks()).toEqual([registeredTask]);
        expect(callback).toHaveBeenCalledTimes(3);
    });

    test('registerTask supports a custom initial delay before the recurring interval', async () => {
        const callback = jest.fn().mockResolvedValue(undefined);
        const host = new BackgroundTaskHost({ environment: 'production', logger });

        host.registerTask({
            name: 'weekly-preview',
            callback,
            timer: {
                intervalMs: 1000,
                initialDelayMs: 500,
            },
        });

        host.start();
        await jest.advanceTimersByTimeAsync(2400);

        expect(callback).toHaveBeenCalledTimes(2);
    });

    test('start logs scheduled activity instead of invoking callbacks outside production', async () => {
        const callback = jest.fn().mockResolvedValue(undefined);
        const host = new BackgroundTaskHost({ environment: 'development', logger });

        host.registerTask({
            name: 'preview-sync',
            callback,
            timer: { intervalMs: 1000 },
        });

        host.start();
        await jest.advanceTimersByTimeAsync(2500);

        expect(callback).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledTimes(2);
        expect(logger.info.mock.calls[0][0]).toContain('preview-sync');
        expect(logger.info.mock.calls[0][0]).toContain('development');
    });

    test('running tasks are not invoked again while a previous execution is still in progress', async () => {
        let resolveCallback;
        const callback = jest.fn(() => new Promise(resolve => {
            resolveCallback = resolve;
        }));
        const host = new BackgroundTaskHost({ environment: 'production', logger });

        host.registerTask({
            name: 'slow-sync',
            callback,
            timer: { intervalMs: 1000 },
        });

        host.start();
        await jest.advanceTimersByTimeAsync(2000);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(logger.warn.mock.calls[0][0]).toContain('slow-sync');

        resolveCallback();
        await Promise.resolve();
    });

    test('stop clears active schedules and registerTask rejects invalid definitions', async () => {
        const callback = jest.fn().mockResolvedValue(undefined);
        const host = new BackgroundTaskHost({ environment: 'production', logger });

        expect(() => host.registerTask({
            name: 'broken-task',
            callback,
            timer: { intervalMs: 0 },
        })).toThrow('positive integer');

        host.registerTask({
            name: 'once-started',
            callback,
            timer: { intervalMs: 1000 },
        });

        expect(() => host.registerTask({
            name: 'once-started',
            callback,
            timer: { intervalMs: 1000 },
        })).toThrow('already registered');

        host.start();
        await jest.advanceTimersByTimeAsync(1000);
        host.stop();
        await jest.advanceTimersByTimeAsync(2000);

        expect(callback).toHaveBeenCalledTimes(1);
    });
});