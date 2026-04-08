import { Email } from '../helpers/email.js';
import { EmailTemplateManager } from '../helpers/email-template-manager.js';
import { getCurrentWeekRangeLocal } from '../helpers/week-range.js';
import { Event } from '../model/event.js';
import { User } from '../model/user.js';

const DIGEST_TEMPLATE_KEY = 'weekly-digest-email';
const DIGEST_EVENT_TEMPLATE_KEY = 'weekly-digest-email-event';
const DIGEST_DAY_SEPARATOR_TEMPLATE_KEY = 'weekly-digest-email-day-separator';

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
 * Builds one stable local day key for digest grouping.
 */
function createEventDayKey(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'invalid-date';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

/**
 * Formats one digest day separator label.
 */
function formatEventDaySeparatorPtBr(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'Data a definir';
    }

    const day = new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    }).format(date);

    return day[0].toUpperCase() + day.slice(1);
}

/**
 * Formats one event date the same way the public UI explains the full date and time.
 */
function formatEventDateTimePtBr(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return 'Data a definir';
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
    
    // capitalize the first letter
    return dateTime[0].toUpperCase() + dateTime.slice(1);
}

/**
 * Formats one event location. If the location is a link format it as an anchor, otherwise return the text or a fallback.
 */
function formatEventLocation(location) {
    const normalized = typeof location === 'string' ? location.trim() : '';

    if (!normalized) {
        return { label: 'Local a definir', href: null };
    }

    try {
        const url = new URL(normalized);
        const websiteName = url.hostname.replace(/^www\./iu, '');
        return {
            label: websiteName,
            href: url.href,
        };
    } catch {
        // not a valid URL, return as plain text
        return { label: normalized, href: null };
    }
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
            pageUrl: buildWeekPageUrl(this.#webBaseUrl),
            calendarUrl: process.env.GOOGLE_CALENDAR_JOIN_URL || '',
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
        const preferenceFilteredUsers = await this.#userModel.listEmailPreferenceRecipients(User.EMAIL_PREFERENCE_KEYS.weeklyDigest, {
            view: ['id', 'name', 'email'],
        });
        if (this.#mailList && Array.isArray(this.#mailList) && this.#mailList.length > 0) {
            const emailsFromMailList = this.#mailList.map((entry) => normalizeEmailAddress(entry?.email)).filter((email) => !!email);
            return normalizeRecipientAudience(preferenceFilteredUsers.filter((user) => emailsFromMailList.includes(normalizeEmailAddress(user?.email))));
        }

        return normalizeRecipientAudience(preferenceFilteredUsers);
    }

    /**
     * Renders the weekly digest email for one recipient.
     */
    renderDigestEmail(recipient, digest) {
        const strings = digest.strings || this.#templateManager.loadJsonTemplate(DIGEST_TEMPLATE_KEY);
        const subject = this.#templateManager.interpolateString(strings.subject || '', {
            weekRangeLabel: digest.weekRangeLabel,
        });
        const signature = this.#templateManager.interpolateString(strings.signature || '', {
            year: new Date().getFullYear(),
        });
        const content = this.#templateManager.loadTemplate(DIGEST_TEMPLATE_KEY, {
            pageUrl: this.#templateManager.escapeHtml(digest.pageUrl) || '',
            calendarUrl: this.#templateManager.escapeHtml(digest.calendarUrl) || '',
            pageButtonText: strings.pageButtonText || '',
            calendarButtonText: strings.calendarButtonText || '',
            emailTitle: strings.emailTitle || '',
            eventBlocks: this.#templateManager.raw(this.#buildEventBlocks(digest.events || [], strings)),
            footerText: strings.footerText || '',
            signature,
            greeting: strings.greeting || '',
            introText: this.#templateManager.interpolateString(strings.introText || '', {
                weekRangeLabel: digest.weekRangeLabel,
            }),
            eventDescriptionText: strings.eventDescriptionText || '',
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

        let previousDayKey = null;

        return events.map((event) => {
            const eventDayKey = createEventDayKey(event?.date);
            const separatorBlock = previousDayKey === eventDayKey
                ? ''
                : this.#templateManager.loadTemplate(DIGEST_DAY_SEPARATOR_TEMPLATE_KEY, {
                    separatorLabel: formatEventDaySeparatorPtBr(event?.date),
                });

            const location = formatEventLocation(event?.location);
            const localtionValue = location.href ? this.#templateManager.interpolateString(strings.locationLinkText || '', {
                location: location.label,
            }) : location.label;
            const locationHtml = location.href ? this.#templateManager.raw(`<a href="${this.#templateManager.escapeHtml(location.href)}" target="_blank" rel="noopener noreferrer">${this.#templateManager.escapeHtml(localtionValue)}</a>`) : this.#templateManager.escapeHtml(localtionValue);
            previousDayKey = eventDayKey;

            return separatorBlock + this.#templateManager.loadTemplate(DIGEST_EVENT_TEMPLATE_KEY, {
                eventDescription: this.#templateManager.raw(
                    this.#templateManager.escapeHtml(String(event?.description || '').trim()),
                ),
                eventTitle: String(event?.title || '').trim() || 'Sem título',
                eventDateLabel: strings.eventDateLabel || '',
                eventDateValue: formatEventDateTimePtBr(event?.date),
                categoryLabel: strings.categoryLabel || '',
                categoryValue: String(event?.categoryLabel || event?.category || strings.categoryFallback || '').trim(),
                locationLabel: strings.locationLabel || '',
                locationValue: locationHtml,
                organizer: strings.organizer ? this.#templateManager.interpolateString(strings.organizer, {
                    organizerName: String(event?.organizerName || strings.organizerFallback || '').trim() || strings.organizerFallback || '',
                }) : '',
            });
        }).join('');
    }
}