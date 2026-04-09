import { WeeklyDigestManager } from './weekly-digest-manager.js';

/**
 * Sends the public weekly digest for the current Sunday-to-Saturday interval.
 */
export async function sendWeeklyDigest({
    referenceDate = new Date(),
    manualTriggeredAt = null,
} = {}) {
    const digestManager = new WeeklyDigestManager({
        mailList: [
            { email: process.env.WEEKLY_DIGEST_EMAIL, name: 'Docentes do IFSul' },
        ]
    });

    return digestManager.sendCurrentWeekDigest(referenceDate, {
        manualTriggeredAt,
    });
}

/**
 * Creates a background task for sending the weekly digest email on Sundays at 6 PM.
 */
export const task = {
    enabled: true,
    rule: 'every sunday at 18:00',
    name: 'weekly-email-digest',
    callback: sendWeeklyDigest,
}