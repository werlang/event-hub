import { Email } from '../helpers/email.js';
import { EmailTemplateManager } from '../helpers/email-template-manager.js';
import { getCurrentWeekRangeLocal } from '../helpers/week-range.js';
import { Event } from '../model/event.js';
import { User } from '../model/user.js';

const DIGEST_TEMPLATE_KEY = 'weekly-digest-email';
const DIGEST_EVENT_TEMPLATE_KEY = 'weekly-digest-email-event';

/**
 * Normalizes one persisted email address for audience resolution.
 */
function normalizeEmailAddress(email) {
    return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

/**
 * Formats one YYYY-MM-DD day token for pt-BR labels.
 */
function formatCalendarDatePtBr(value) {
    const [yearText, monthText, dayText] = String(value || '').split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);

    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
        return '';
    }

    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(year, month - 1, day));
}

/**
 * Builds the public-facing label for one Sunday-to-Saturday range.
 */
function createWeekRangeLabel(weekRange) {
    const fromLabel = formatCalendarDatePtBr(weekRange?.from);
    const toLabel = formatCalendarDatePtBr(weekRange?.to);

    return fromLabel && toLabel
        ? `${fromLabel} a ${toLabel}`
        : 'Semana atual';
}

/**
 * Formats one event date the same way the public UI explains the full date and time.
 */
function formatEventDateTimePtBr(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'Data a definir';
    }

    return new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date);
}

/**
 * Normalizes one configured web base URL for digest action links.
 */
function normalizeWebBaseUrl(webBaseUrl) {
    const normalized = typeof webBaseUrl === 'string' ? webBaseUrl.trim() : '';

    if (!normalized) {
        return '';
    }

    return normalized.replace(/\/+$/u, '');
}

/**
 * Resolves the digest action URL that points recipients back to the public week page.
 */
function buildWeekPageUrl(webBaseUrl) {
    const normalizedBaseUrl = normalizeWebBaseUrl(webBaseUrl);
    return normalizedBaseUrl ? `${normalizedBaseUrl}/week` : '';
}

/**
 * Builds the explicit digest audience from persisted user rows.
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
 * Assembles and sends the weekly public digest email for the current Sunday-to-Saturday window.
 */
export class WeeklyDigestManager {
    #emailHelper;
    #templateManager;
    #eventModel;
    #userModel;
    #logger;
    #webBaseUrl;
    #mailList;

    /**
     * Creates one digest manager around the shared email and template infrastructure.
     *
     * @param {object} [options] Digest dependencies and configuration.
     * @param {Email} [options.emailHelper] The shared email sender.
     * @param {EmailTemplateManager} [options.templateManager] The shared localized template loader.
     * @param {typeof Event} [options.eventModel] The event model used to read the current-week dataset.
     * @param {typeof User} [options.userModel] The user model used to resolve the explicit recipient list.
     * @param {object} [options.logger=console] The logger used for digest lifecycle messages.
     * @param {string} [options.webBaseUrl=process.env.WEB_URL || ''] The base public web URL used for the optional week-page link.
     * @param {Array<{ email: string, name: string }>} [options.mailList] An optional explicit mail list that overrides the persisted user audience.
     */
    constructor({
        emailHelper = new Email({
            testing: process.env.EMAIL_TESTING === 'true',
        }),
        templateManager = new EmailTemplateManager(),
        eventModel = Event,
        userModel = User,
        logger = console,
        webBaseUrl = process.env.WEB_URL || '',
        mailList = null,
    } = {}) {
        this.#emailHelper = emailHelper;
        this.#templateManager = templateManager;
        this.#eventModel = eventModel;
        this.#userModel = userModel;
        this.#logger = logger;
        this.#webBaseUrl = webBaseUrl;
        this.#mailList = mailList;
    }

    /**
     * Loads the same published current-week event dataset used by the public week page.
     */
    async getCurrentWeekDigest(referenceDate = new Date()) {
        const weekRange = getCurrentWeekRangeLocal(referenceDate);
        const strings = this.#templateManager.loadJsonTemplate(DIGEST_TEMPLATE_KEY);
        const events = await this.#eventModel.listCurrentWeek(referenceDate);

        return {
            actionUrl: buildWeekPageUrl(this.#webBaseUrl),
            events,
            strings,
            weekRange,
            weekRangeLabel: createWeekRangeLabel(weekRange),
        };
    }

    /**
     * Returns the explicit weekly digest audience.
     */
    async listRecipients() {
        if (this.#mailList) {
            return normalizeRecipientAudience(this.#mailList);
        }

        const persistedUsers = await this.#userModel.list({
            view: ['id', 'name', 'email'],
        });
        return normalizeRecipientAudience(persistedUsers);
    }

    /**
     * Renders the weekly digest email for one recipient.
     */
    renderDigestEmail(recipient, digest) {
        const safeName = typeof recipient?.name === 'string' ? recipient.name.trim() : '';
        const strings = digest.strings || this.#templateManager.loadJsonTemplate(DIGEST_TEMPLATE_KEY);
        const greeting = safeName
            ? this.#templateManager.interpolateString(strings.greetingWithName || '', {
                name: safeName,
            })
            : this.#templateManager.interpolateString(strings.greetingWithoutName || '');
        const subject = this.#templateManager.interpolateString(strings.subject || '', {
            weekRangeLabel: digest.weekRangeLabel,
        });
        const content = this.#templateManager.loadTemplate(DIGEST_TEMPLATE_KEY, {
            actionUrl: this.#templateManager.escapeHtml(digest.actionUrl) || '',
            buttonText: this.#templateManager.escapeHtml(strings.buttonText || ''),
            emailTitle: strings.emailTitle || '',
            eventBlocks: this.#templateManager.raw(this.#buildEventBlocks(digest.events || [], strings)),
            footerText: strings.footerText || '',
            greeting,
            introText: this.#templateManager.interpolateString(strings.introText || '', {
                weekRangeLabel: digest.weekRangeLabel,
            }),
            recipientPolicyText: strings.recipientPolicyText || '',
            reviewText: strings.reviewText || '',
            weekRangeLabel: digest.weekRangeLabel || '',
        });

        return { subject, content };
    }

    /**
     * Sends the current-week digest once per persisted recipient email address.
     */
    async sendCurrentWeekDigest(referenceDate = new Date()) {
        const digest = await this.getCurrentWeekDigest(referenceDate);
        const recipients = await this.listRecipients();

        if (recipients.length === 0) {
            this.#logger.info('Weekly digest skipped because there are no persisted recipient email addresses.');
            return {
                eventCount: digest.events.length,
                recipientCount: 0,
                sentCount: 0,
                weekRange: digest.weekRange,
            };
        }

        const deliveries = [];

        for (const recipient of recipients) {
            const message = this.renderDigestEmail(recipient, digest);
            const info = await this.#emailHelper.send([recipient.email], message.subject, message.content);

            deliveries.push({
                email: recipient.email,
                messageId: info?.messageId || null,
            });
        }

        this.#logger.info(`Weekly digest sent to ${deliveries.length} persisted recipient(s).`);

        return {
            deliveries,
            eventCount: digest.events.length,
            recipientCount: recipients.length,
            sentCount: deliveries.length,
            weekRange: digest.weekRange,
        };
    }

    /**
     * Builds the MJML blocks for the current digest event list.
     */
    #buildEventBlocks(events, strings) {
        if (!Array.isArray(events) || events.length === 0) {
            return this.#templateManager.loadTemplate(DIGEST_EVENT_TEMPLATE_KEY, {
                calendarHtml: '',
                eventDescription: strings.emptyStateText || '',
                eventTitle: strings.emptyStateTitle || '',
                metaHtml: '',
            });
        }

        return events.map((event) => this.#templateManager.loadTemplate(DIGEST_EVENT_TEMPLATE_KEY, {
            calendarHtml: this.#templateManager.raw(this.#buildCalendarHtml(event, strings)),
            eventDescription: this.#templateManager.raw(
                this.#templateManager.escapeHtml(String(event?.description || '').trim()),
            ),
            eventTitle: String(event?.title || '').trim() || 'Sem título',
            metaHtml: this.#templateManager.raw(this.#buildMetaHtml(event, strings)),
        })).join('');
    }

    /**
     * Builds the MJML metadata rows shown for one event block.
     */
    #buildMetaHtml(event, strings) {
        const metaRows = [
            {
                label: strings.eventDateLabel,
                value: formatEventDateTimePtBr(event?.date),
            },
            {
                label: strings.categoryLabel,
                value: String(event?.categoryLabel || event?.category || strings.categoryFallback || '').trim(),
            },
            {
                label: strings.locationLabel,
                value: String(event?.location || strings.locationFallback || '').trim() || strings.locationFallback || '',
            },
            {
                label: strings.organizerLabel,
                value: String(event?.organizerName || strings.organizerFallback || '').trim() || strings.organizerFallback || '',
            },
        ].filter((row) => row.label && row.value);

        return metaRows.map((row) => `
        <mj-text font-size="13px" color="#344054" padding="2px 0">
            <strong>${this.#templateManager.escapeHtml(row.label)}:</strong> ${this.#templateManager.escapeHtml(row.value)}
        </mj-text>`).join('');
    }

    /**
     * Builds the optional Google Calendar link block for one published event.
     */
    #buildCalendarHtml(event, strings) {
        const calendarLink = String(event?.calendarLink || '').trim();

        if (!calendarLink) {
            return '';
        }

        return `
        <mj-button align="left" background-color="#edf4ff" color="#1d4ed8" href="${this.#templateManager.escapeHtml(calendarLink)}" inner-padding="10px 14px" font-size="13px" border-radius="999px">
            ${this.#templateManager.escapeHtml(strings.calendarLinkText || '')}
        </mj-button>`;
    }
}