import { WeeklyDigestManager } from './weekly-digest-manager.js';
import config from '../config/weekly-digest.config.js';

/**
 * Sends the public weekly digest for the current Sunday-to-Saturday interval.
 */
export async function sendWeeklyDigest({
    referenceDate = new Date(),
    manualTriggeredAt = null,
} = {}) {
    const digestManager = new WeeklyDigestManager({
        mailList: config.mailList || [],
        singleEmail: Boolean(config.singleEmail),
    });

    return digestManager.sendCurrentWeekDigest(referenceDate, {
        manualTriggeredAt,
    });
}

/**
 * Creates a background task for sending the weekly digest email on Sundays at 6 PM.
 */
export const task = {
    enabled: config.enabled || false,
    rule: config.rule || 'every monday at 07:30',
    name: 'weekly-email-digest',
    callback: sendWeeklyDigest,
}