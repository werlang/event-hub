import { afterEach, describe, expect, jest, test } from '@jest/globals';

describe('background/weekly-digest-task', () => {
    const originalWeeklyDigestEmail = process.env.WEEKLY_DIGEST_EMAIL;

    afterEach(() => {
        jest.resetModules();
        jest.restoreAllMocks();
        process.env.WEEKLY_DIGEST_EMAIL = originalWeeklyDigestEmail;
    });

    test('exports the weekly digest task config with the current schedule and canonical name', async () => {
        jest.unstable_mockModule('../../background/weekly-digest-manager.js', () => ({
            WeeklyDigestManager: class WeeklyDigestManager {
                async sendCurrentWeekDigest() {}
            },
        }));

        const { task } = await import('../../background/weekly-digest-task.js');

        expect(task.enabled).toBe(true);
        expect(task.rule).toBe('every thursday at 19:19');
        expect(task.name).toBe('weekly-email-digest');
        expect(typeof task.callback).toBe('function');
    });

    test('runs the weekly digest manager with the configured recipient override for scheduled and manual sends', async () => {
        const managerOptions = [];
        const sendCurrentWeekDigest = jest.fn(async (_referenceDate, options) => ({
            manualTriggeredAt: options?.manualTriggeredAt?.toISOString() || null,
            sentCount: 1,
        }));
        process.env.WEEKLY_DIGEST_EMAIL = 'pablowerlang@ifsul.edu.br';

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
                mailList: [
                    {
                        email: 'pablowerlang@ifsul.edu.br',
                        name: 'Docentes do IFSul',
                    },
                ],
            },
            {
                mailList: [
                    {
                        email: 'pablowerlang@ifsul.edu.br',
                        name: 'Docentes do IFSul',
                    },
                ],
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