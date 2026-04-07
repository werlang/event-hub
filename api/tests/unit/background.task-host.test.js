import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { BackgroundTask } from '../../background/task-host.js';

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

    test('start schedules a human-friendly weekly rule in production', async () => {
        const callback = jest.fn().mockResolvedValue(undefined);
        const task = new BackgroundTask('every sunday at 18:00', callback, {
            environment: 'production',
            logger,
            timers: globalThis,
            getNow: () => new Date(2026, 3, 12, 17, 59, 59, 0),
            name: 'weekly-sunday-foo',
        });

        task.start();
        await jest.advanceTimersByTimeAsync(999);

        expect(callback).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(1);

        expect(callback).toHaveBeenCalledTimes(1);

        task.stop();
    });

    test('start schedules cron expressions directly', async () => {
        const callback = jest.fn().mockResolvedValue(undefined);
        const task = new BackgroundTask('0 18 * * 0', callback, {
            environment: 'production',
            logger,
            timers: globalThis,
            getNow: () => new Date(2026, 3, 12, 17, 59, 59, 0),
            name: 'weekly-cron-sync',
        });

        task.start();
        await jest.advanceTimersByTimeAsync(999);

        expect(callback).not.toHaveBeenCalled();

        await jest.advanceTimersByTimeAsync(1);

        expect(callback).toHaveBeenCalledTimes(1);

        task.stop();
    });

    test('start logs scheduled activity instead of invoking callbacks outside production', async () => {
        const callback = jest.fn().mockResolvedValue(undefined);
        const task = new BackgroundTask('every sunday at 18:00', callback, {
            environment: 'development',
            logger,
            timers: globalThis,
            getNow: () => new Date(2026, 3, 12, 17, 59, 59, 0),
            name: 'preview-sync',
        });

        task.start();
        await jest.advanceTimersByTimeAsync(1000);

        expect(callback).not.toHaveBeenCalled();
        expect(logger.info).toHaveBeenCalledTimes(1);
        expect(logger.info.mock.calls[0][0]).toContain('preview-sync');
        expect(logger.info.mock.calls[0][0]).toContain('development');

        task.stop();
    });

    test('running tasks are not invoked again while a previous execution is still in progress', async () => {
        let resolveCallback;
        const callback = jest.fn(() => new Promise(resolve => {
            resolveCallback = resolve;
        }));
        const task = new BackgroundTask('*/1 * * * * *', callback, {
            environment: 'production',
            logger,
            timers: globalThis,
            timeZone: 'UTC',
            getNow: () => new Date('2026-04-07T12:00:00.500Z'),
            name: 'slow-sync',
        });

        task.start();
        await jest.advanceTimersByTimeAsync(1500);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledTimes(1);
        expect(logger.warn.mock.calls[0][0]).toContain('slow-sync');

        resolveCallback();
        await Promise.resolve();

        task.stop();
    });

    test('stop clears the pending schedule and invalid rules are rejected', async () => {
        const callback = jest.fn().mockResolvedValue(undefined);

        expect(() => new BackgroundTask('nonsense', callback)).toThrow('cron expression or a supported human-friendly rule');

        const task = new BackgroundTask('*/1 * * * * *', callback, {
            environment: 'production',
            logger,
            timers: globalThis,
            timeZone: 'UTC',
            getNow: () => new Date('2026-04-07T12:00:00.500Z'),
            name: 'stop-me',
        });

        task.start();
        task.stop();
        await jest.advanceTimersByTimeAsync(5000);

        expect(callback).not.toHaveBeenCalled();
    });
});