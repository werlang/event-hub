import { BackgroundTask } from './background-task.js';
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

const task = new BackgroundTask('every sunday at 18:00', sendWeeklyDigest, {
    name: 'weekly-email-digest',
});

export { task };