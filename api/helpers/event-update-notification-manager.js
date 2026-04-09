import { Email } from './email.js';
import { EmailTemplateManager } from './email-template-manager.js';
import { User } from '../model/user.js';

const EVENT_UPDATE_MJML_TEMPLATE_KEY = 'notification-email';
const EVENT_UPDATE_STRINGS_TEMPLATE_KEY = 'event-update-email';
const EVENT_DELETE_STRINGS_TEMPLATE_KEY = 'event-delete-email';
const NOTIFICATION_SECTION_TEMPLATE_KEY = 'notification-email-section';

/**
 * Normalizes one persisted email address before it is used as a recipient.
 *
 * @param {string} email The raw email address.
 * @returns {string} The normalized recipient email.
 */
function normalizeEmailAddress(email) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/**
 * Formats one event date using the localized pt-BR day and time conventions.
 *
 * @param {string|Date} value The date-like value to format.
 * @param {string} [fallback=''] The fallback label used when the date is invalid.
 * @returns {string} The localized date label.
 */
function formatEventDateTimePtBr(value, fallback = '') {
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
    }).format(date);

    return dateTime[0].toUpperCase() + dateTime.slice(1);
}

/**
 * Normalizes the configured web base URL before dashboard links are built.
 *
 * @param {string} webBaseUrl The configured public web base URL.
 * @returns {string} The normalized URL without trailing slashes.
 */
function normalizeWebBaseUrl(webBaseUrl) {
    const normalized = typeof webBaseUrl === 'string' ? webBaseUrl.trim() : '';

    if (!normalized) {
        return '';
    }

    return normalized.replace(/\/+$/u, '');
}

/**
 * Builds the dashboard URL used by owner-facing update emails.
 *
 * @param {string} webBaseUrl The configured public web base URL.
 * @returns {string} The dashboard entry URL.
 */
function buildDashboardUrl(webBaseUrl) {
    const normalizedBaseUrl = normalizeWebBaseUrl(webBaseUrl);
    return normalizedBaseUrl ? `${normalizedBaseUrl}/dashboard` : '';
}

/**
 * Sends the styled owner notification used when an administrator edits an event.
 */
export class EventUpdateNotificationManager {
    #emailHelper;
    #templateManager;
    #logger;
    #webBaseUrl;

    /**
     * Creates one event-update notification manager around the shared email infrastructure.
     *
     * @param {object} [options] Notification dependencies and configuration.
     * @param {Email} [options.emailHelper] The shared email sender.
     * @param {EmailTemplateManager} [options.templateManager] The shared localized template loader.
     * @param {object} [options.logger=console] The logger used for notification lifecycle messages.
     * @param {string} [options.webBaseUrl=process.env.WEB_URL || ''] The public web base URL used for dashboard links.
     */
    constructor({
        emailHelper = new Email({
            testing: process.env.EMAIL_TESTING === 'true',
        }),
        templateManager = new EmailTemplateManager(),
        logger = console,
        webBaseUrl = process.env.WEB_URL || '',
    } = {}) {
        this.#emailHelper = emailHelper;
        this.#templateManager = templateManager;
        this.#logger = logger;
        this.#webBaseUrl = webBaseUrl;
    }

    /**
     * Resolves the opted-in owner recipient for one event-update notification.
     *
     * @param {object} owner The event owner snapshot.
     * @returns {object|null} The recipient metadata when delivery is allowed.
     */
    readRecipient(owner) {
        const email = normalizeEmailAddress(owner?.email);

        if (!email || !User.allowsEmailPreference(owner, User.EMAIL_PREFERENCE_KEYS.eventUpdates)) {
            return null;
        }

        return {
            email,
            name: typeof owner?.name === 'string' ? owner.name.trim() : '',
        };
    }

    /**
     * Renders the styled owner notification for one admin-edited event.
     *
     * @param {object} recipient The recipient metadata.
     * @param {object} payload The edited event context.
     * @param {object} payload.event The updated event snapshot.
     * @param {object} [payload.editor] The administrator who edited the event.
     * @returns {{subject: string, content: string}} The rendered email message.
     */
    renderEventUpdatedEmail(recipient, { event, editor } = {}) {
        const strings = this.#templateManager.loadJsonTemplate(EVENT_UPDATE_STRINGS_TEMPLATE_KEY);
        return this.#renderOwnerNotificationEmail(strings, recipient, { event, editor });
    }

    /**
     * Renders the styled owner notification for one admin-deleted event.
     *
     * @param {object} recipient The recipient metadata.
     * @param {object} payload The deleted event context.
     * @param {object} payload.event The deleted event snapshot.
     * @param {object} [payload.editor] The administrator who deleted the event.
     * @returns {{subject: string, content: string}} The rendered email message.
     */
    renderEventDeletedEmail(recipient, { event, editor } = {}) {
        const strings = this.#templateManager.loadJsonTemplate(EVENT_DELETE_STRINGS_TEMPLATE_KEY);
        return this.#renderOwnerNotificationEmail(strings, recipient, { event, editor });
    }

    /**
     * Builds the shared owner-notification email shape for one admin action.
     *
     * @private
     * @param {Record<string, string>} strings The localized notification strings.
     * @param {object} recipient The recipient metadata.
     * @param {object} payload The event context.
     * @param {object} payload.event The event snapshot.
     * @param {object} [payload.editor] The administrator who performed the action.
     * @returns {{subject: string, content: string}} The rendered email message.
     */
    #renderOwnerNotificationEmail(strings, recipient, { event, editor } = {}) {
        const greeting = this.#templateManager.interpolateString(strings.greetingWithName || '', {
            name: recipient?.name || 'participante',
        });
        const content = this.#templateManager.loadTemplate(EVENT_UPDATE_MJML_TEMPLATE_KEY, {
            brandName: strings.brandName || '',
            emailTitle: strings.emailTitle || '',
            eyebrowText: strings.eyebrowText || '',
            greeting,
            introText: strings.introText || '',
            summaryTitle: strings.summaryLabel || '',
            summaryDescriptionText: strings.summaryDescriptionText || '',
            summaryBlocks: this.#templateManager.raw(this.#buildSummaryBlocks({ event, editor, strings })),
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
     * Sends the owner notification when the user allows event-update emails.
     *
     * @param {object} payload The edited event context.
     * @param {object} payload.event The updated event snapshot.
     * @param {object} payload.owner The event owner snapshot.
     * @param {object} [payload.editor] The administrator who edited the event.
     * @returns {Promise<object>} A delivery summary for the owner notification.
     */
    async notifyEventUpdated({ event, owner, editor } = {}) {
        const recipient = this.readRecipient(owner);

        if (!recipient) {
            this.#logger.info('Event-update owner notification skipped because the owner is missing, has no email, or opted out.');
            return {
                delivery: null,
                recipient: null,
                sentCount: 0,
                skipped: true,
            };
        }

        const message = this.renderEventUpdatedEmail(recipient, { event, editor });
        const info = await this.#emailHelper.send([recipient.email], message.subject, message.content);

        this.#logger.info(`Event-update owner notification sent to ${recipient.email}.`);

        return {
            delivery: {
                email: recipient.email,
                messageId: info?.messageId || null,
            },
            recipient,
            sentCount: 1,
            skipped: false,
        };
    }

    /**
     * Sends the owner notification when an administrator deletes an event.
     *
     * @param {object} payload The deleted event context.
     * @param {object} payload.event The deleted event snapshot.
     * @param {object} payload.owner The event owner snapshot.
     * @param {object} [payload.editor] The administrator who deleted the event.
     * @returns {Promise<object>} A delivery summary for the owner notification.
     */
    async notifyEventDeleted({ event, owner, editor } = {}) {
        const recipient = this.readRecipient(owner);

        if (!recipient) {
            this.#logger.info('Event-delete owner notification skipped because the owner is missing, has no email, or opted out.');
            return {
                delivery: null,
                recipient: null,
                sentCount: 0,
                skipped: true,
            };
        }

        const message = this.renderEventDeletedEmail(recipient, { event, editor });
        const info = await this.#emailHelper.send([recipient.email], message.subject, message.content);

        this.#logger.info(`Event-delete owner notification sent to ${recipient.email}.`);

        return {
            delivery: {
                email: recipient.email,
                messageId: info?.messageId || null,
            },
            recipient,
            sentCount: 1,
            skipped: false,
        };
    }

    /**
     * Builds the localized summary blocks used by the owner notification template.
     *
     * @private
     * @param {object} payload The edited event context.
     * @param {object} payload.event The updated event snapshot.
     * @param {object} [payload.editor] The administrator who edited the event.
     * @param {Record<string, string>} payload.strings The localized notification strings.
     * @returns {string} The rendered MJML summary blocks.
     */
    #buildSummaryBlocks({ event, editor, strings }) {
        const actorName = editor?.name || strings.valueUnavailable || '';

        return this.#templateManager.loadTemplate(NOTIFICATION_SECTION_TEMPLATE_KEY, {
            cardLabel: strings.summaryLabel || '',
            eventTitle: event?.title || strings.valueUnavailable || '',
            actorText: `${strings.editorLabel || ''}: ${actorName}`,
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