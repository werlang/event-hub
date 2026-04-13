import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

const existsSyncMock = jest.fn();
const readFileSyncMock = jest.fn();
const jwtMock = jest.fn((options) => ({ options }));
const insertMock = jest.fn();
const deleteMock = jest.fn();
const calendarFactoryMock = jest.fn((options) => ({
    events: {
        insert: insertMock,
        delete: deleteMock,
    },
    options,
}));

jest.unstable_mockModule('fs', () => ({
    default: {
        existsSync: existsSyncMock,
        readFileSync: readFileSyncMock,
    },
}));

jest.unstable_mockModule('googleapis', () => ({
    google: {
        auth: {
            JWT: jwtMock,
        },
        calendar: calendarFactoryMock,
    },
}));

/**
 * Loads a fresh Google Calendar helper module instance for one isolated test case.
 *
 * @returns {Promise<typeof import('../../helpers/google-calendar.js')>} The imported helper module.
 */
async function loadGoogleCalendarModule() {
    return import(`../../helpers/google-calendar.js?case=${Date.now()}-${Math.random()}`);
}

beforeEach(() => {
    jest.resetModules();
    process.env.GOOGLE_CALENDAR_ENABLED = 'true';
    existsSyncMock.mockReset();
    readFileSyncMock.mockReset();
    jwtMock.mockClear();
    insertMock.mockReset();
    deleteMock.mockReset();
    calendarFactoryMock.mockClear();
});

afterEach(() => {
    jest.resetModules();
    delete process.env.GOOGLE_CALENDAR_ENABLED;
});

describe('helpers/google-calendar', () => {
    test('isEnabled returns false when the environment flag is disabled', async () => {
        process.env.GOOGLE_CALENDAR_ENABLED = 'false';

        const { GoogleCalendarPublisher } = await loadGoogleCalendarModule();

        expect(GoogleCalendarPublisher.isEnabled()).toBe(false);
        expect(existsSyncMock).not.toHaveBeenCalled();
        expect(readFileSyncMock).not.toHaveBeenCalled();
    });

    test('isEnabled returns false when the credentials file is missing', async () => {
        existsSyncMock.mockReturnValue(false);

        const { GoogleCalendarPublisher } = await loadGoogleCalendarModule();

        expect(GoogleCalendarPublisher.isEnabled()).toBe(false);
        expect(readFileSyncMock).not.toHaveBeenCalled();
    });

    test('isEnabled returns true when a valid credentials file is available', async () => {
        existsSyncMock.mockReturnValue(true);
        readFileSyncMock.mockReturnValue(JSON.stringify({
            calendar_id: 'calendar-id',
            client_email: 'calendar-service@example.com',
            private_key: 'line-1\\nline-2',
            event_duration_minutes: 90,
        }));

        const { GoogleCalendarPublisher } = await loadGoogleCalendarModule();

        expect(GoogleCalendarPublisher.isEnabled()).toBe(true);
    });

    test('publishApprovedEvent creates the Google Calendar payload with normalized credentials', async () => {
        existsSyncMock.mockReturnValue(true);
        readFileSyncMock.mockReturnValue(JSON.stringify({
            calendar_id: 'calendar-id',
            client_email: 'calendar-service@example.com',
            private_key: 'line-1\\nline-2',
            event_duration_minutes: 90,
        }));
        insertMock.mockResolvedValue({
            data: {
                id: ' calendar-event-1 ',
                htmlLink: ' https://calendar.local/event-1 ',
            },
        });

        const { GoogleCalendarPublisher } = await loadGoogleCalendarModule();
        const result = await GoogleCalendarPublisher.publishApprovedEvent({
            id: 'event-1',
            title: 'Feira de Ciências',
            description: 'Mostra de projetos integradores.',
            categoryLabel: 'Acadêmico',
            location: 'Auditório Central',
            date: '2026-06-12T18:00:00.000Z',
        });

        expect(result).toEqual({
            id: 'calendar-event-1',
            htmlLink: 'https://calendar.local/event-1',
        });
        expect(jwtMock).toHaveBeenCalledWith({
            email: 'calendar-service@example.com',
            key: 'line-1\nline-2',
            scopes: ['https://www.googleapis.com/auth/calendar.events'],
        });
        expect(calendarFactoryMock).toHaveBeenCalledWith({
            version: 'v3',
            auth: {
                options: {
                    email: 'calendar-service@example.com',
                    key: 'line-1\nline-2',
                    scopes: ['https://www.googleapis.com/auth/calendar.events'],
                },
            },
        });
        expect(insertMock).toHaveBeenCalledWith({
            calendarId: 'calendar-id',
            requestBody: {
                summary: 'Feira de Ciências',
                description: 'Mostra de projetos integradores.\n\nCategoria: Acadêmico\n\nLocal: Auditório Central\n\nEvento interno: event-1',
                location: 'Auditório Central',
                start: {
                    dateTime: '2026-06-12T18:00:00.000Z',
                },
                end: {
                    dateTime: '2026-06-12T19:30:00.000Z',
                },
                extendedProperties: {
                    private: {
                        agendaChEventId: 'event-1',
                    },
                },
            },
        });
    });

    test('publishApprovedEvent becomes a no-op when the environment flag is disabled', async () => {
        process.env.GOOGLE_CALENDAR_ENABLED = 'false';

        const { GoogleCalendarPublisher } = await loadGoogleCalendarModule();
        const result = await GoogleCalendarPublisher.publishApprovedEvent({
            id: 'event-disabled-1',
            date: '2026-06-12T18:00:00.000Z',
        });

        expect(result).toBeNull();
        expect(existsSyncMock).not.toHaveBeenCalled();
        expect(readFileSyncMock).not.toHaveBeenCalled();
        expect(jwtMock).not.toHaveBeenCalled();
        expect(insertMock).not.toHaveBeenCalled();
    });

    test('publishApprovedEvent falls back to the default duration and summary for sparse events', async () => {
        existsSyncMock.mockReturnValue(true);
        readFileSyncMock.mockReturnValue(JSON.stringify({
            calendar_id: 'calendar-id',
            client_email: 'calendar-service@example.com',
            private_key: 'line-1\\nline-2',
            event_duration_minutes: '0',
        }));
        insertMock.mockResolvedValue({ data: {} });

        const { GoogleCalendarPublisher } = await loadGoogleCalendarModule();

        await GoogleCalendarPublisher.publishApprovedEvent({
            id: 'event-2',
            date: '2026-06-12T18:00:00.000Z',
            location: '   ',
        });

        expect(insertMock).toHaveBeenCalledWith({
            calendarId: 'calendar-id',
            requestBody: expect.objectContaining({
                summary: 'Evento acadêmico',
                description: 'Local:    \n\nEvento interno: event-2',
                location: undefined,
                end: {
                    dateTime: '2026-06-12T19:00:00.000Z',
                },
            }),
        });
    });

    test('publishApprovedEvent rejects invalid event dates and incomplete credentials', async () => {
        existsSyncMock.mockReturnValue(true);
        readFileSyncMock.mockReturnValue(JSON.stringify({
            calendar_id: 'calendar-id',
            client_email: 'calendar-service@example.com',
            private_key: 'line-1\\nline-2',
        }));

        const { GoogleCalendarPublisher } = await loadGoogleCalendarModule();

        await expect(GoogleCalendarPublisher.publishApprovedEvent({
            id: 'event-invalid-date',
            date: 'not-a-date',
        })).rejects.toMatchObject({
            name: 'CustomError',
            message: 'Approved event has an invalid date and cannot be published to Google Calendar.',
            data: {
                eventId: 'event-invalid-date',
                eventDate: 'not-a-date',
            },
        });

        readFileSyncMock.mockReturnValue(JSON.stringify({
            calendar_id: '',
            client_email: 'calendar-service@example.com',
            private_key: 'line-1\\nline-2',
        }));

        const { GoogleCalendarPublisher: BrokenGoogleCalendarPublisher } = await loadGoogleCalendarModule();

        await expect(BrokenGoogleCalendarPublisher.publishApprovedEvent({
            id: 'event-3',
            date: '2026-06-12T18:00:00.000Z',
        })).rejects.toMatchObject({
            name: 'CustomError',
            message: 'Google Calendar credentials JSON must include calendar_id, client_email, and private_key.',
            data: {
                calendarId: '',
                serviceAccountEmail: 'calendar-service@example.com',
                hasPrivateKey: true,
            },
        });
    });

    test('deleteEvent skips blank ids and delegates deletes when the integration is enabled', async () => {
        existsSyncMock.mockReturnValue(true);
        readFileSyncMock.mockReturnValue(JSON.stringify({
            calendar_id: 'calendar-id',
            client_email: 'calendar-service@example.com',
            private_key: 'line-1\\nline-2',
        }));

        const { GoogleCalendarPublisher } = await loadGoogleCalendarModule();

        await expect(GoogleCalendarPublisher.deleteEvent('   ')).resolves.toBeUndefined();
        await expect(GoogleCalendarPublisher.deleteEvent(' calendar-event-2 ')).resolves.toBeUndefined();

        expect(deleteMock).toHaveBeenCalledTimes(1);
        expect(deleteMock).toHaveBeenCalledWith({
            calendarId: 'calendar-id',
            eventId: 'calendar-event-2',
        });
    });

    test('deleteEvent becomes a no-op when the environment flag is disabled', async () => {
        process.env.GOOGLE_CALENDAR_ENABLED = 'false';

        const { GoogleCalendarPublisher } = await loadGoogleCalendarModule();

        await expect(GoogleCalendarPublisher.deleteEvent('calendar-event-disabled')).resolves.toBeUndefined();

        expect(existsSyncMock).not.toHaveBeenCalled();
        expect(readFileSyncMock).not.toHaveBeenCalled();
        expect(jwtMock).not.toHaveBeenCalled();
        expect(deleteMock).not.toHaveBeenCalled();
    });
});