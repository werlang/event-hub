import { google } from 'googleapis';

const DEFAULT_EVENT_DURATION_MINUTES = 60;

/**
 * Reads one environment variable as a trimmed string.
 */
function readEnvValue(name) {
    return typeof process.env[name] === 'string'
        ? process.env[name].trim()
        : '';
}

/**
 * Normalizes a service-account private key loaded from environment variables.
 */
function normalizePrivateKey(privateKey) {
    return privateKey.replace(/\\n/g, '\n');
}

/**
 * Parses the default Google Calendar event duration in minutes.
 */
function parseEventDurationMinutes(value) {
    const parsedValue = Number.parseInt(String(value || DEFAULT_EVENT_DURATION_MINUTES), 10);
    return Number.isInteger(parsedValue) && parsedValue > 0
        ? parsedValue
        : DEFAULT_EVENT_DURATION_MINUTES;
}

/**
 * Builds the text description sent to Google Calendar for one approved event.
 */
function buildCalendarDescription(event) {
    const descriptionLines = [String(event?.description || '').trim()].filter(Boolean);

    if (event?.categoryLabel) {
        descriptionLines.push(`Categoria: ${event.categoryLabel}`);
    }

    if (event?.location) {
        descriptionLines.push(`Local: ${event.location}`);
    }

    if (event?.id) {
        descriptionLines.push(`Evento interno: ${event.id}`);
    }

    return descriptionLines.join('\n\n');
}

/**
 * Reads the Google Calendar runtime configuration from the environment.
 */
function readRuntimeConfig() {
    const calendarId = readEnvValue('GOOGLE_CALENDAR_ID');
    const serviceAccountEmail = readEnvValue('GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL');
    const serviceAccountPrivateKey = readEnvValue('GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY');

    const configuredValues = [calendarId, serviceAccountEmail, serviceAccountPrivateKey].filter(Boolean);
    if (configuredValues.length === 0) {
        return null;
    }

    if (configuredValues.length !== 3) {
        throw new Error(
            'Google Calendar integration is partially configured. Set GOOGLE_CALENDAR_ID, GOOGLE_CALENDAR_SERVICE_ACCOUNT_EMAIL, and GOOGLE_CALENDAR_SERVICE_ACCOUNT_PRIVATE_KEY together.',
        );
    }

    return {
        calendarId,
        serviceAccountEmail,
        serviceAccountPrivateKey: normalizePrivateKey(serviceAccountPrivateKey),
        defaultDurationMinutes: parseEventDurationMinutes(process.env.GOOGLE_CALENDAR_EVENT_DURATION_MINUTES),
    };
}

/**
 * Builds the Google Calendar event payload for one approved repository event.
 */
function buildCalendarEventPayload(event, durationMinutes) {
    const startDate = new Date(event?.date);
    if (Number.isNaN(startDate.getTime())) {
        throw new Error('Approved event has an invalid date and cannot be published to Google Calendar.');
    }

    const endDate = new Date(startDate.getTime() + (durationMinutes * 60 * 1000));

    return {
        summary: String(event?.title || 'Evento acadêmico').trim() || 'Evento acadêmico',
        description: buildCalendarDescription(event),
        location: String(event?.location || '').trim() || undefined,
        start: {
            dateTime: startDate.toISOString(),
        },
        end: {
            dateTime: endDate.toISOString(),
        },
        extendedProperties: {
            private: {
                eventHubEventId: String(event?.id || '').trim(),
            },
        },
    };
}

/**
 * Publishes approved events to a shared Google Calendar when configured.
 */
export class GoogleCalendarPublisher {

    /**
     * Indicates whether the integration is fully configured.
     */
    static isEnabled() {
        return Boolean(readRuntimeConfig());
    }

    /**
     * Creates the Google Calendar client or returns null when integration is disabled.
     */
    static #createClient() {
        const config = readRuntimeConfig();
        if (!config) {
            return null;
        }

        const auth = new google.auth.JWT({
            email: config.serviceAccountEmail,
            key: config.serviceAccountPrivateKey,
            scopes: ['https://www.googleapis.com/auth/calendar.events'],
        });

        return {
            calendarId: config.calendarId,
            defaultDurationMinutes: config.defaultDurationMinutes,
            calendar: google.calendar({ version: 'v3', auth }),
        };
    }

    /**
     * Creates one Google Calendar event for an approved repository event.
     */
    static async publishApprovedEvent(event) {
        const client = this.#createClient();
        if (!client) {
            return null;
        }

        const response = await client.calendar.events.insert({
            calendarId: client.calendarId,
            requestBody: buildCalendarEventPayload(event, client.defaultDurationMinutes),
        });

        return {
            id: String(response.data?.id || '').trim() || null,
            htmlLink: String(response.data?.htmlLink || '').trim() || null,
        };
    }

    /**
     * Removes one Google Calendar event created during the current moderation flow.
     */
    static async deleteEvent(calendarEventId) {
        const normalizedEventId = String(calendarEventId || '').trim();
        if (!normalizedEventId) {
            return;
        }

        const client = this.#createClient();
        if (!client) {
            return;
        }

        await client.calendar.events.delete({
            calendarId: client.calendarId,
            eventId: normalizedEventId,
        });
    }
}