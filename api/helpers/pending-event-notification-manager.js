import { Email } from './email.js';
import { EmailTemplateManager } from './email-template-manager.js';
import { User } from '../model/user.js';

const NOTIFICATION_TEMPLATE_KEY = 'notification-email';
const NOTIFICATION_SECTION_TEMPLATE_KEY = 'notification-email-section';
const EMAIL_EVENT_TIME_ZONE = 'America/Sao_Paulo';

/**
 * Normalizes one persisted email address for recipient de-duplication.
 *
 * @param {string} email The email address to normalize.
 * @returns {string} The normalized email address.
 */
function normalizeEmailAddress(email) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/**
 * Formats one event date and time using the same pt-BR conventions used elsewhere in the project.
 *
 * @param {string|Date} value The date-like value to format.
 * @param {string} [fallback=''] The fallback label used when the date is invalid.
 * @param {string} [timeZone='America/Sao_Paulo'] The IANA time zone used by the email.
 * @returns {string} The localized date label.
 */
function formatEventDateTimePtBr(value, fallback = '', timeZone = EMAIL_EVENT_TIME_ZONE) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return fallback;
    }

    const dateTime = new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone,
        timeZoneName: 'short',
    }).format(date);

    return dateTime[0].toUpperCase() + dateTime.slice(1);
}

/**
 * Normalizes one configured web base URL before building dashboard links.
 *
 * @param {string} webBaseUrl The configured public web base URL.
 * @returns {string} The normalized base URL without trailing slashes.
 */
function normalizeWebBaseUrl(webBaseUrl) {
    const normalized = typeof webBaseUrl === 'string' ? webBaseUrl.trim() : '';

    if (!normalized) {
        return '';
    }

    return normalized.replace(/\/+$/u, '');
}

/**
 * Builds the public dashboard URL used by admin review notifications.
 *
 * @param {string} webBaseUrl The configured public web base URL.
 * @returns {string} The moderation entry URL.
 */
function buildDashboardUrl(webBaseUrl) {
    const normalizedBaseUrl = normalizeWebBaseUrl(webBaseUrl);
    return normalizedBaseUrl ? `${normalizedBaseUrl}/dashboard` : '';
}

/**
 * Normalizes one explicit recipient audience resolved from persisted users.
 *
 * @param {Array<object>} users The persisted user rows.
 * @returns {Array<object>} The unique recipient audience.
 */
function normalizeRecipientAudience(users = []) {
    const recipientsByEmail = new Map();

    for (const user of users) {
        const email = normalizeEmailAddress(user?.email);

        if (!email || recipientsByEmail.has(email)) {
            continue;
        }

        recipientsByEmail.set(email, {
            email,
            name: typeof user?.name === 'string' ? user.name.trim() : '',
        });
    }

    return Array.from(recipientsByEmail.values());
}

/**
 * Sends the styled admin notification used when an event enters the moderation queue.
 */
export class PendingEventNotificationManager {
    #emailHelper;
    #templateManager;
    #userModel;
    #logger;
    #webBaseUrl;

    /**
     * Creates one pending-event notification manager around the shared email infrastructure.
     *
     * @param {object} [options] Notification dependencies and configuration.
     * @param {Email} [options.emailHelper] The shared email sender.
     * @param {EmailTemplateManager} [options.templateManager] The shared localized template loader.
     * @param {typeof User} [options.userModel] The user model used to resolve admin recipients.
     * @param {object} [options.logger=console] The logger used for notification lifecycle messages.
     * @param {string} [options.webBaseUrl=process.env.WEB_URL || ''] The public web base URL used for dashboard links.
     */
    constructor({
        emailHelper = new Email({
            testing: process.env.EMAIL_TESTING === 'true',
        }),
        templateManager = new EmailTemplateManager(),
        userModel = User,
        logger = console,
        webBaseUrl = process.env.WEB_URL || '',
    } = {}) {
        this.#emailHelper = emailHelper;
        this.#templateManager = templateManager;
        this.#userModel = userModel;
        this.#logger = logger;
        this.#webBaseUrl = webBaseUrl;
    }

    /**
     * Returns the persisted opted-in admin audience for pending-request emails.
     *
     * @returns {Promise<Array<object>>} The normalized recipient audience.
     */
    async listRecipients() {
        const persistedUsers = await this.#userModel.listEmailPreferenceRecipients(User.EMAIL_PREFERENCE_KEYS.adminPendingRequests, {
            role: 'admin',
            view: ['id', 'name', 'email'],
        });

        return normalizeRecipientAudience(persistedUsers);
    }

    /**
     * Renders the styled admin notification for one submitted event.
     *
     * @param {object} recipient The recipient user snapshot.
     * @param {object} payload The submitted event context.
     * @param {object} payload.event The submitted event.
     * @param {object} [payload.organizer] The organizer snapshot associated with the submission.
     * @returns {{subject: string, content: string}} The rendered email message.
     */
    renderPendingApprovalEmail(recipient, { event, organizer } = {}) {
        const strings = this.#templateManager.loadJsonTemplate(NOTIFICATION_TEMPLATE_KEY);
        const greeting = this.#templateManager.interpolateString(strings.greetingWithName || '', {
            name: recipient?.name || 'admin',
        });
        const content = this.#templateManager.loadTemplate(NOTIFICATION_TEMPLATE_KEY, {
            brandName: strings.brandName || '',
            emailTitle: strings.emailTitle || '',
            eyebrowText: strings.eyebrowText || '',
            greeting,
            introText: strings.introText || '',
            summaryTitle: strings.summaryLabel || '',
            summaryDescriptionText: strings.summaryDescriptionText || '',
            summaryBlocks: this.#templateManager.raw(this.#buildSummaryBlocks({ event, organizer, strings })),
            reviewText: strings.reviewText || '',
            actionUrl: buildDashboardUrl(this.#webBaseUrl),
            buttonText: strings.buttonText || '',
            footerText: strings.footerText || '',
        });

        return {
            subject: strings.subject || '',
            content,
        };
    }

    /**
     * Sends the pending-review notification once per opted-in admin email address.
     *
     * @param {object} payload The submitted event context.
     * @param {object} payload.event The submitted event.
     * @param {object} [payload.organizer] The organizer snapshot associated with the submission.
     * @returns {Promise<object>} A delivery summary with successful and failed recipients.
     */
    async notifyPendingApproval({ event, organizer } = {}) {
        const recipients = await this.listRecipients();

        if (recipients.length === 0) {
            this.#logger.info('Pending-event notification skipped because there are no opted-in admin recipients.');
            return {
                deliveries: [],
                failures: [],
                failedCount: 0,
                recipientCount: 0,
                sentCount: 0,
            };
        }

        const deliveries = [];
        const failures = [];

        for (const recipient of recipients) {
            try {
                const message = this.renderPendingApprovalEmail(recipient, { event, organizer });
                const info = await this.#emailHelper.send([recipient.email], message.subject, message.content);

                deliveries.push({
                    email: recipient.email,
                    messageId: info?.messageId || null,
                });
            } catch (error) {
                const failure = {
                    email: recipient.email,
                    message: error instanceof Error ? error.message : String(error),
                };

                failures.push(failure);
                this.#logger.error?.(`Pending-event notification failed for ${recipient.email}:`, error);
            }
        }

        this.#logger.info(`Pending-event notification sent to ${deliveries.length} admin recipient(s) with ${failures.length} failure(s).`);

        return {
            deliveries,
            failures,
            failedCount: failures.length,
            recipientCount: recipients.length,
            sentCount: deliveries.length,
        };
    }

    /**
     * Builds the localized summary section blocks for one submitted event.
     *
     * @private
     * @param {object} payload The submitted event context.
     * @param {object} payload.event The submitted event.
     * @param {object} [payload.organizer] The organizer snapshot associated with the submission.
     * @param {Record<string, string>} payload.strings The localized notification strings.
     * @returns {string} The rendered MJML summary blocks.
     */
    #buildSummaryBlocks({ event, organizer, strings }) {
        const actorName = organizer?.name || event?.organizerName || strings.valueUnavailable || '';

        return this.#templateManager.loadTemplate(NOTIFICATION_SECTION_TEMPLATE_KEY, {
            cardLabel: strings.summaryLabel || '',
            eventTitle: event?.title || strings.valueUnavailable || '',
            actorText: `${strings.organizerLabel || ''}: ${actorName}`,
            eventDescription: event?.description || strings.valueUnavailable || '',
            eventDateLabel: strings.dateLabel || '',
            eventDateValue: formatEventDateTimePtBr(event?.date, strings.dateFallback || strings.valueUnavailable || ''),
            locationLabel: strings.locationLabel || '',
            locationValue: event?.location || strings.valueUnavailable || '',
            categoryLabel: strings.categoryLabel || '',
            categoryValue: event?.categoryLabel || event?.category || strings.valueUnavailable || '',
        });
    }
}