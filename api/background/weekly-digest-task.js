import { WeeklyDigestManager } from './weekly-digest-manager.js';

/**
 * Sends the public weekly digest for the current Sunday-to-Saturday interval.
 */
async function sendWeeklyDigest() {
    const digestManager = new WeeklyDigestManager({
        mailList: [
            { email: process.env.WEEKLY_DIGEST_EMAIL, name: 'Docentes do IFSul' },
        ]
    });
    await digestManager.sendCurrentWeekDigest();
}

/**
 * Creates a background task for sending the weekly digest email on Sundays at 6 PM.
 */
export const task = {
    rule: 'every sunday at 18:00',
    name: 'weekly-email-digest',
    callback: sendWeeklyDigest,
}