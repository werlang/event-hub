import { afterEach, describe, expect, jest, test } from '@jest/globals';

describe('background/weekly-digest-task', () => {
    afterEach(() => {
        jest.resetModules();
        jest.restoreAllMocks();
    });

    test('exports the weekly digest task config with the current schedule and canonical name', async () => {
        jest.unstable_mockModule('../../background/weekly-digest-manager.js', () => ({
            WeeklyDigestManager: class WeeklyDigestManager {
                async sendCurrentWeekDigest() {}
            },
        }));

        const { default: config } = await import('../../config/weekly-digest.config.js');
        const { task } = await import('../../background/weekly-digest-task.js');

        expect(task.enabled).toBe(config.enabled);
        expect(task.rule).toBe(config.rule);
        expect(task.name).toBe('weekly-email-digest');
        expect(typeof task.callback).toBe('function');
    });

    test('runs the weekly digest manager with the configured recipient override for scheduled and manual sends', async () => {
        const managerOptions = [];
        const sendCurrentWeekDigest = jest.fn(async (_referenceDate, options) => ({
            manualTriggeredAt: options?.manualTriggeredAt?.toISOString() || null,
            sentCount: 1,
        }));

        jest.unstable_mockModule('../../background/weekly-digest-manager.js', () => ({
            WeeklyDigestManager: class WeeklyDigestManager {
                constructor(options) {
                    managerOptions.push(options);
                }

                async sendCurrentWeekDigest(referenceDate, options) {
                    return sendCurrentWeekDigest(referenceDate, options);
                }
            },
        }));

        const { default: config } = await import('../../config/weekly-digest.config.js');
        const { sendWeeklyDigest, task } = await import('../../background/weekly-digest-task.js');
        const referenceDate = new Date('2026-04-07T12:00:00.000Z');
        const manualTriggeredAt = new Date('2026-04-09T16:30:00.000Z');

        await expect(sendWeeklyDigest({ referenceDate, manualTriggeredAt })).resolves.toEqual({
            manualTriggeredAt: '2026-04-09T16:30:00.000Z',
            sentCount: 1,
        });
        await expect(task.callback()).resolves.toEqual({
            manualTriggeredAt: null,
            sentCount: 1,
        });

        expect(managerOptions).toEqual([
            {
                mailList: config.mailList,
                singleEmail: true,
            },
            {
                mailList: config.mailList,
                singleEmail: true,
            },
        ]);
        expect(sendCurrentWeekDigest).toHaveBeenCalledTimes(2);
        expect(sendCurrentWeekDigest).toHaveBeenNthCalledWith(1, referenceDate, {
            manualTriggeredAt,
        });
        expect(sendCurrentWeekDigest.mock.calls[1][0]).toBeInstanceOf(Date);
        expect(sendCurrentWeekDigest).toHaveBeenNthCalledWith(2, sendCurrentWeekDigest.mock.calls[1][0], {
            manualTriggeredAt: null,
        });
    });
});