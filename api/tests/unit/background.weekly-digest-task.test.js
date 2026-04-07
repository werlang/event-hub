import { afterEach, describe, expect, jest, test } from '@jest/globals';

describe('background/weekly-digest-task', () => {
    afterEach(() => {
        jest.resetModules();
        jest.restoreAllMocks();
    });

    test('exports the weekly digest task with the Sunday 18:00 schedule and canonical name', async () => {
        const createdTasks = [];

        jest.unstable_mockModule('../../background/background-task.js', () => ({
            BackgroundTask: class BackgroundTask {
                constructor(rule, callback, options = {}) {
                    this.rule = rule;
                    this.callback = callback;
                    this.options = options;
                    createdTasks.push(this);
                }
            },
        }));
        jest.unstable_mockModule('../../helpers/weekly-digest-manager.js', () => ({
            WeeklyDigestManager: class WeeklyDigestManager {
                async sendCurrentWeekDigest() {}
            },
        }));

        const { task } = await import('../../background/weekly-digest-task.js');

        expect(createdTasks).toHaveLength(1);
        expect(task).toBe(createdTasks[0]);
        expect(task.rule).toBe('every sunday at 18:00');
        expect(task.options).toEqual({
            name: 'weekly-email-digest',
        });
        expect(typeof task.callback).toBe('function');
    });

    test('runs the weekly digest manager when the scheduled callback executes', async () => {
        const createdTasks = [];
        const sendCurrentWeekDigest = jest.fn(async () => {});

        jest.unstable_mockModule('../../background/background-task.js', () => ({
            BackgroundTask: class BackgroundTask {
                constructor(rule, callback, options = {}) {
                    this.rule = rule;
                    this.callback = callback;
                    this.options = options;
                    createdTasks.push(this);
                }
            },
        }));
        jest.unstable_mockModule('../../helpers/weekly-digest-manager.js', () => ({
            WeeklyDigestManager: class WeeklyDigestManager {
                async sendCurrentWeekDigest() {
                    return sendCurrentWeekDigest();
                }
            },
        }));

        await import('../../background/weekly-digest-task.js');

        await expect(createdTasks[0].callback()).resolves.toBeUndefined();
        expect(sendCurrentWeekDigest).toHaveBeenCalledTimes(1);
    });
});