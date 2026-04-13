import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { CustomError } from './error.js';

const DEFAULT_EVENT_DURATION_MINUTES = 60;
const CREDENTIALS_PATH = path.resolve(process.cwd(), 'config', 'google-credentials.json');

/**
 * Indicates whether Google Calendar publishing is explicitly enabled by environment.
 */
function isGoogleCalendarEnabled() {
    return process.env.GOOGLE_CALENDAR_ENABLED === 'true';
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
 * Reads the Google Calendar service-account credentials JSON file.
 */
function readCredentialsFile() {
    if (!fs.existsSync(CREDENTIALS_PATH)) {
        return null;
    }

    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
    const calendarId = String(credentials.calendar_id || credentials.calendarId || '').trim();
    const serviceAccountEmail = String(credentials.client_email || '').trim();
    const serviceAccountPrivateKey = normalizePrivateKey(String(credentials.private_key || '').trim());

    if (!calendarId || !serviceAccountEmail || !serviceAccountPrivateKey) {
        throw new CustomError('Google Calendar credentials JSON must include calendar_id, client_email, and private_key.', {
            calendarId,
            serviceAccountEmail,
            hasPrivateKey: Boolean(serviceAccountPrivateKey),
        });
    }

    return {
        calendarId,
        serviceAccountEmail,
        serviceAccountPrivateKey,
        defaultDurationMinutes: parseEventDurationMinutes(credentials.event_duration_minutes),
    };
}

/**
 * Reads the Google Calendar runtime configuration from the credentials JSON file.
 */
function readRuntimeConfig() {
    if (!isGoogleCalendarEnabled()) {
        return null;
    }

    return readCredentialsFile();
}

/**
 * Builds the Google Calendar event payload for one approved repository event.
 */
function buildCalendarEventPayload(event, durationMinutes) {
    const startDate = new Date(event?.date);
    if (Number.isNaN(startDate.getTime())) {
        throw new CustomError('Approved event has an invalid date and cannot be published to Google Calendar.', {
            eventId: event?.id,
            eventDate: event?.date,
        });
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
                agendaChEventId: String(event?.id || '').trim(),
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