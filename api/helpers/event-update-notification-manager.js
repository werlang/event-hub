import { Email } from './email.js';
import { EmailTemplateManager } from './email-template-manager.js';
import { User } from '../model/user.js';

const EVENT_UPDATE_MJML_TEMPLATE_KEY = 'notification-email';
const EVENT_UPDATE_STRINGS_TEMPLATE_KEY = 'event-update-email';
const EVENT_APPROVED_STRINGS_TEMPLATE_KEY = 'event-approved-email';
const EVENT_REJECTED_STRINGS_TEMPLATE_KEY = 'event-rejected-email';
const EVENT_DELETE_STRINGS_TEMPLATE_KEY = 'event-delete-email';
const NOTIFICATION_SECTION_TEMPLATE_KEY = 'notification-email-section';
const EMAIL_EVENT_TIME_ZONE = 'America/Sao_Paulo';

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
 * Sends the styled owner notification used when an administrator changes or moderates an event.
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
     * Renders the styled owner notification for one approved event.
     *
     * @param {object} recipient The recipient metadata.
     * @param {object} payload The approved event context.
     * @param {object} payload.event The approved event snapshot.
     * @param {object} [payload.editor] The administrator who approved the event.
     * @returns {{subject: string, content: string}} The rendered email message.
     */
    renderEventApprovedEmail(recipient, { event, editor } = {}) {
        const strings = this.#templateManager.loadJsonTemplate(EVENT_APPROVED_STRINGS_TEMPLATE_KEY);
        return this.#renderOwnerNotificationEmail(strings, recipient, { event, editor });
    }

    /**
     * Renders the styled owner notification for one rejected event.
     *
     * @param {object} recipient The recipient metadata.
     * @param {object} payload The rejected event context.
     * @param {object} payload.event The rejected event snapshot.
     * @param {object} [payload.editor] The administrator who rejected the event.
     * @returns {{subject: string, content: string}} The rendered email message.
     */
    renderEventRejectedEmail(recipient, { event, editor } = {}) {
        const strings = this.#templateManager.loadJsonTemplate(EVENT_REJECTED_STRINGS_TEMPLATE_KEY);
        return this.#renderOwnerNotificationEmail(strings, recipient, {
            event,
            editor,
            reviewTextVariables: {
                rejectionReason: event?.rejectionReason || strings.rejectionReasonFallback || strings.valueUnavailable || '',
            },
        });
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
     * @param {Record<string, string>} [payload.reviewTextVariables] Placeholder values interpolated into the review copy.
     * @returns {{subject: string, content: string}} The rendered email message.
     */
    #renderOwnerNotificationEmail(strings, recipient, { event, editor, reviewTextVariables } = {}) {
        const greeting = this.#templateManager.interpolateString(strings.greetingWithName || '', {
            name: recipient?.name || 'participante',
        });
        const reviewText = this.#templateManager.interpolateString(strings.reviewText || '', reviewTextVariables || {});
        const content = this.#templateManager.loadTemplate(EVENT_UPDATE_MJML_TEMPLATE_KEY, {
            brandName: strings.brandName || '',
            emailTitle: strings.emailTitle || '',
            eyebrowText: strings.eyebrowText || '',
            greeting,
            introText: strings.introText || '',
            summaryTitle: strings.summaryLabel || '',
            summaryDescriptionText: strings.summaryDescriptionText || '',
            summaryBlocks: this.#templateManager.raw(this.#buildSummaryBlocks({ event, editor, strings })),
            reviewText,
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
        return this.#notifyOwner({
            event,
            owner,
            editor,
            renderEmail: this.renderEventUpdatedEmail.bind(this),
            logPrefix: 'Event-update',
        });
    }

    /**
     * Sends the owner notification when an administrator approves an event.
     *
     * @param {object} payload The approved event context.
     * @param {object} payload.event The approved event snapshot.
     * @param {object} payload.owner The event owner snapshot.
     * @param {object} [payload.editor] The administrator who approved the event.
     * @returns {Promise<object>} A delivery summary for the owner notification.
     */
    async notifyEventApproved({ event, owner, editor } = {}) {
        return this.#notifyOwner({
            event,
            owner,
            editor,
            renderEmail: this.renderEventApprovedEmail.bind(this),
            logPrefix: 'Event-approval',
        });
    }

    /**
     * Sends the owner notification when an administrator rejects an event.
     *
     * @param {object} payload The rejected event context.
     * @param {object} payload.event The rejected event snapshot.
     * @param {object} payload.owner The event owner snapshot.
     * @param {object} [payload.editor] The administrator who rejected the event.
     * @returns {Promise<object>} A delivery summary for the owner notification.
     */
    async notifyEventRejected({ event, owner, editor } = {}) {
        return this.#notifyOwner({
            event,
            owner,
            editor,
            renderEmail: this.renderEventRejectedEmail.bind(this),
            logPrefix: 'Event-rejection',
        });
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
        return this.#notifyOwner({
            event,
            owner,
            editor,
            renderEmail: this.renderEventDeletedEmail.bind(this),
            logPrefix: 'Event-delete',
        });
    }

    /**
     * Sends one owner notification when the recipient exists and allows event-update emails.
     *
     * @private
     * @param {object} payload The owner notification context.
     * @param {object} payload.event The affected event snapshot.
     * @param {object} payload.owner The event owner snapshot.
     * @param {object} [payload.editor] The administrator who triggered the notification.
     * @param {Function} payload.renderEmail The renderer used to build the final message.
     * @param {string} payload.logPrefix The log prefix used for skip and success messages.
     * @returns {Promise<object>} A delivery summary for the owner notification.
     */
    async #notifyOwner({ event, owner, editor, renderEmail, logPrefix }) {
        const recipient = this.readRecipient(owner);

        if (!recipient) {
            this.#logger.info(`${logPrefix} owner notification skipped because the owner is missing, has no email, or opted out.`);
            return {
                delivery: null,
                recipient: null,
                sentCount: 0,
                skipped: true,
            };
        }

        const message = renderEmail(recipient, { event, editor });
        const info = await this.#emailHelper.send([recipient.email], message.subject, message.content);

        this.#logger.info(`${logPrefix} owner notification sent to ${recipient.email}.`);

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