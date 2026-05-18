import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { router as eventsRouter } from '../../routes/events.js';
import { EventUpdateNotificationManager } from '../../helpers/event-update-notification-manager.js';
import { GoogleCalendarPublisher } from '../../helpers/google-calendar.js';
import { PendingEventNotificationManager } from '../../helpers/pending-event-notification-manager.js';
import { Event } from '../../model/event.js';
import { User } from '../../model/user.js';
import { buildEvent, buildUser } from './support/fixtures.js';
import { createResponseDouble, restoreTracked, trackReplacement } from './support/doubles.js';
import { getRouteHandlers, runRouteHandlers } from './support/router.js';

const restores = [];

function createRequest(overrides = {}) {
    return {
        body: {},
        headers: {},
        params: {},
        query: {},
        user: undefined,
        ...overrides,
    };
}

afterEach(() => {
    restoreTracked(restores);
});

describe('routes/events', () => {
    const listHandlers = getRouteHandlers(eventsRouter, 'get', '/');
    const mineHandlers = getRouteHandlers(eventsRouter, 'get', '/mine').slice(1);
    const moderationListHandlers = getRouteHandlers(eventsRouter, 'get', '/moderation').slice(1);
    const getByIdHandlers = getRouteHandlers(eventsRouter, 'get', '/:id');
    const createHandlers = getRouteHandlers(eventsRouter, 'post', '/').slice(1);
    const updateHandlers = getRouteHandlers(eventsRouter, 'put', '/:id').slice(1);
    const deleteHandlers = getRouteHandlers(eventsRouter, 'delete', '/:id').slice(1);
    const moderationDecisionHandlers = getRouteHandlers(eventsRouter, 'put', '/:id/moderation').slice(1);

    test('list passes supported filters to Event.list and returns the envelope', async () => {
        const calls = [];
        trackReplacement(restores, Event, 'list', async filters => {
            calls.push(filters);
            return [buildEvent({ status: 'published', organizerName: 'Ada Lovelace' })];
        });

        const res = createResponseDouble();
        const next = jest.fn();
        await runRouteHandlers(listHandlers, createRequest({
            query: {
                q: 'comp',
                category: 'Tecnologia',
                from: '2026-05-01',
                to: '2026-05-31',
            },
            headers: {
                timezone: 'America/Sao_Paulo',
            },
        }), res, next);

        expect(next).not.toHaveBeenCalled();
        expect(calls).toEqual([{
            search: 'comp',
            category: 'Tecnologia',
            from: '2026-05-01',
            to: '2026-05-31',
            timezone: 'America/Sao_Paulo',
        }]);
        expect(res.body.data.events).toHaveLength(1);
        expect(res.body.data.events[0].organizerName).toBe('Ada Lovelace');
    });

    test('list maps unexpected failures to a 500 error', async () => {
        trackReplacement(restores, Event, 'list', async () => {
            throw new Error('query failed');
        });

        const next = jest.fn();
        await runRouteHandlers(listHandlers, createRequest(), createResponseDouble(), next);

        expect(next.mock.calls[0][0].status).toBe(500);
        expect(next.mock.calls[0][0].message).toBe('Não foi possível carregar os eventos.');
    });

    test('mine returns the authenticated organizers events and wraps unexpected failures', async () => {
        trackReplacement(restores, Event, 'listByOrganizer', async organizerId => [buildEvent({ organizerId })]);
        const successRes = createResponseDouble();
        const successNext = jest.fn();
        await runRouteHandlers(mineHandlers, createRequest({ user: { id: 'user-1' } }), successRes, successNext);
        expect(successNext).not.toHaveBeenCalled();
        expect(successRes.body.data.events[0].organizerId).toBe('user-1');

        trackReplacement(restores, Event, 'listByOrganizer', async () => {
            throw new Error('query failed');
        });
        const errorNext = jest.fn();
        await runRouteHandlers(mineHandlers, createRequest({ user: { id: 'user-1' } }), createResponseDouble(), errorNext);
        expect(errorNext.mock.calls[0][0].status).toBe(500);
    });

    test('moderation listing enforces admin access, supports status filters, and wraps failures', async () => {
        const calls = [];
        trackReplacement(restores, Event, 'listForModeration', async options => {
            calls.push(options);
            return [buildEvent({ status: 'pending', organizerName: 'Ada Lovelace' })];
        });

        const successRes = createResponseDouble();
        const successNext = jest.fn();
        await runRouteHandlers(moderationListHandlers, createRequest({ user: { id: 'admin-1', role: 'admin' }, query: { status: 'rejected' } }), successRes, successNext);
        expect(successNext).not.toHaveBeenCalled();
        expect(calls).toEqual([{ moderatorId: undefined, status: 'rejected' }]);
        expect(successRes.body.data.events[0].organizerName).toBe('Ada Lovelace');

        const forbiddenNext = jest.fn();
        await runRouteHandlers(moderationListHandlers, createRequest({ user: { id: 'user-1', role: 'member' } }), createResponseDouble(), forbiddenNext);
        expect(forbiddenNext.mock.calls[0][0].status).toBe(403);

        const invalidStatusNext = jest.fn();
        await runRouteHandlers(moderationListHandlers, createRequest({ user: { id: 'admin-1', role: 'admin' }, query: { status: 'published' } }), createResponseDouble(), invalidStatusNext);
        expect(invalidStatusNext.mock.calls[0][0].status).toBe(400);

        trackReplacement(restores, Event, 'listForModeration', async () => {
            throw new Error('query failed');
        });
        const errorNext = jest.fn();
        await runRouteHandlers(moderationListHandlers, createRequest({ user: { id: 'admin-1', role: 'admin' } }), createResponseDouble(), errorNext);
        expect(errorNext.mock.calls[0][0].status).toBe(500);
    });

    test('getById returns a public event, handles missing ids, and wraps failures', async () => {
        trackReplacement(restores, Event, 'findPublicById', async id => (id === 'event-1' ? buildEvent({ id, status: 'published' }) : null));

        const successRes = createResponseDouble();
        const successNext = jest.fn();
        await runRouteHandlers(getByIdHandlers, createRequest({ params: { id: 'event-1' } }), successRes, successNext);
        expect(successNext).not.toHaveBeenCalled();
        expect(successRes.body.data.event.id).toBe('event-1');

        const missingNext = jest.fn();
        await runRouteHandlers(getByIdHandlers, createRequest({ params: { id: 'event-2' } }), createResponseDouble(), missingNext);
        expect(missingNext.mock.calls[0][0].status).toBe(404);

        trackReplacement(restores, Event, 'findPublicById', async () => {
            throw new Error('query failed');
        });
        const errorNext = jest.fn();
        await runRouteHandlers(getByIdHandlers, createRequest({ params: { id: 'event-1' } }), createResponseDouble(), errorNext);
        expect(errorNext.mock.calls[0][0].status).toBe(500);
    });

    test('create validates payload, applies defaults, and wraps failures', async () => {
        const createCalls = [];
        const notificationCalls = [];
        trackReplacement(restores, Event, 'create', async payload => {
            createCalls.push(payload);
            return buildEvent({ ...payload, status: 'pending' });
        });
        trackReplacement(restores, PendingEventNotificationManager.prototype, 'notifyPendingApproval', async payload => {
            notificationCalls.push(payload);
            return { sentCount: 1 };
        });

        const successRes = createResponseDouble();
        const successNext = jest.fn();
        await runRouteHandlers(createHandlers, createRequest({
            user: buildUser({ id: 'user-1' }),
            body: {
                title: 'Semana Academica',
                description: 'Palestras para a comunidade.',
                date: '2026-06-01T10:00:00.000Z',
            },
        }), successRes, successNext);
        expect(successNext).not.toHaveBeenCalled();
        expect(createCalls[0]).toEqual({
            title: 'Semana Academica',
            description: 'Palestras para a comunidade.',
            date: '2026-06-01T10:00:00.000Z',
            category: 'outro',
            location: 'A definir',
            organizerId: 'user-1',
        });
        expect(notificationCalls).toHaveLength(1);
        expect(notificationCalls[0]).toMatchObject({
            event: expect.objectContaining({
                title: 'Semana Academica',
                organizerId: 'user-1',
            }),
            organizer: expect.objectContaining({
                id: 'user-1',
                email: 'ada@example.com',
            }),
        });

        const missingNext = jest.fn();
        await runRouteHandlers(createHandlers, createRequest({ user: { id: 'user-1' }, body: { title: 'Semana Academica' } }), createResponseDouble(), missingNext);
        expect(missingNext.mock.calls[0][0].status).toBe(400);

        const invalidDateNext = jest.fn();
        await runRouteHandlers(createHandlers, createRequest({ user: { id: 'user-1' }, body: { title: 'Semana Academica', description: 'Palestras', date: 'not-a-date' } }), createResponseDouble(), invalidDateNext);
        expect(invalidDateNext.mock.calls[0][0].status).toBe(400);

        trackReplacement(restores, Event, 'create', async () => {
            throw new Error('write failed');
        });
        const errorNext = jest.fn();
        await runRouteHandlers(createHandlers, createRequest({ user: { id: 'user-1' }, body: { title: 'Semana Academica', description: 'Palestras', date: '2026-06-01T10:00:00.000Z' } }), createResponseDouble(), errorNext);
        expect(errorNext.mock.calls[0][0].status).toBe(500);
    });

    test('create keeps the submission successful when admin notification delivery fails', async () => {
        trackReplacement(restores, Event, 'create', async payload => buildEvent({ ...payload, status: 'pending' }));
        trackReplacement(restores, PendingEventNotificationManager.prototype, 'notifyPendingApproval', async () => {
            throw new Error('smtp timeout');
        });

        const errorLog = jest.fn();
        trackReplacement(restores, console, 'error', errorLog);

        const successRes = createResponseDouble();
        const successNext = jest.fn();
        await runRouteHandlers(createHandlers, createRequest({
            user: buildUser({ id: 'user-1' }),
            body: {
                title: 'Semana Academica',
                description: 'Palestras para a comunidade.',
                date: '2026-06-01T10:00:00.000Z',
            },
        }), successRes, successNext);

        expect(successNext).not.toHaveBeenCalled();
        expect(successRes.statusCode).toBe(201);
        expect(errorLog).toHaveBeenCalledWith('Failed to send pending-event admin notification:', expect.any(Error));
    });

    test('update enforces ownership, keeps approved owner edits forbidden, and wraps failures', async () => {
        const updateCalls = [];
        const calendarDeleteCalls = [];
        const notificationCalls = [];
        const ownerNotificationCalls = [];
        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'rejected', organizerId: 'user-1' }));
        trackReplacement(restores, Event, 'updateDetails', async (id, payload) => {
            updateCalls.push({ id, payload });
            return buildEvent({ id, ...payload, organizerId: 'user-1' });
        });
        trackReplacement(restores, GoogleCalendarPublisher, 'deleteEvent', async calendarEventId => {
            calendarDeleteCalls.push(calendarEventId);
        });
        trackReplacement(restores, PendingEventNotificationManager.prototype, 'notifyPendingApproval', async payload => {
            notificationCalls.push(payload);
            return { sentCount: 1 };
        });
        trackReplacement(restores, EventUpdateNotificationManager.prototype, 'notifyEventUpdated', async payload => {
            ownerNotificationCalls.push(payload);
            return { sentCount: 1 };
        });

        const successRes = createResponseDouble();
        const successNext = jest.fn();
        await runRouteHandlers(updateHandlers, createRequest({
            user: buildUser({ id: 'user-1' }),
            params: { id: 'event-1' },
            body: {
                title: 'Novo titulo',
                description: 'Novo resumo',
                date: '2026-06-10T19:00:00.000Z',
                category: 'Tecnologia',
                location: 'Laboratorio',
            },
        }), successRes, successNext);
        expect(successNext).not.toHaveBeenCalled();
        expect(updateCalls[0]).toEqual({
            id: 'event-1',
            payload: {
                title: 'Novo titulo',
                description: 'Novo resumo',
                date: '2026-06-10T19:00:00.000Z',
                category: 'Tecnologia',
                location: 'Laboratorio',
                status: 'pending',
                rejectionReason: null,
                calendarLink: null,
                calendarEventId: null,
            },
        });
        expect(notificationCalls).toHaveLength(1);
        expect(calendarDeleteCalls).toEqual([]);
        expect(notificationCalls[0]).toMatchObject({
            event: expect.objectContaining({
                id: 'event-1',
                status: 'pending',
            }),
            organizer: expect.objectContaining({
                id: 'user-1',
            }),
        });

        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'pending', organizerId: 'user-1' }));
        trackReplacement(restores, Event, 'updateDetails', async (id, payload) => buildEvent({ id, ...payload, organizerId: 'user-1' }));
        const pendingRes = createResponseDouble();
        const pendingNext = jest.fn();
        await runRouteHandlers(updateHandlers, createRequest({
            user: buildUser({ id: 'user-1' }),
            params: { id: 'event-2' },
            body: {
                title: 'Outro titulo',
                description: 'Outro resumo',
                date: '2026-06-12T19:00:00.000Z',
            },
        }), pendingRes, pendingNext);
        expect(pendingNext).not.toHaveBeenCalled();
        expect(notificationCalls).toHaveLength(1);

        trackReplacement(restores, Event, 'findById', async id => buildEvent({
            id,
            status: 'published',
            organizerId: 'user-1',
            calendarLink: 'https://calendar.google.com/calendar/event?eid=calendar-event-1',
            calendarEventId: 'calendar-event-1',
        }));
        trackReplacement(restores, Event, 'updateDetails', async (id, payload) => {
            updateCalls.push({ id, payload });
            return buildEvent({ id, ...payload, organizerId: 'user-1' });
        });
        const publishedNext = jest.fn();
        await runRouteHandlers(updateHandlers, createRequest({
            user: buildUser({ id: 'user-1' }),
            params: { id: 'event-3' },
            body: {
                title: 'Evento atualizado',
                description: 'Versão revisada do conteúdo',
                date: '2026-06-15T19:00:00.000Z',
            },
        }), createResponseDouble(), publishedNext);
        expect(publishedNext.mock.calls[0][0].status).toBe(403);
        expect(calendarDeleteCalls).toEqual([]);
        expect(notificationCalls).toHaveLength(1);
        expect(ownerNotificationCalls).toEqual([]);

        trackReplacement(restores, Event, 'findById', async () => null);
        const missingNext = jest.fn();
        await runRouteHandlers(updateHandlers, createRequest({ user: { id: 'user-1' }, params: { id: 'event-1' }, body: { title: 'Novo', description: 'Resumo', date: '2026-06-10T19:00:00.000Z' } }), createResponseDouble(), missingNext);
        expect(missingNext.mock.calls[0][0].status).toBe(404);

        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'pending', organizerId: 'other-user' }));
        const forbiddenNext = jest.fn();
        await runRouteHandlers(updateHandlers, createRequest({ user: { id: 'user-1' }, params: { id: 'event-1' }, body: { title: 'Novo', description: 'Resumo', date: '2026-06-10T19:00:00.000Z' } }), createResponseDouble(), forbiddenNext);
        expect(forbiddenNext.mock.calls[0][0].status).toBe(403);

        trackReplacement(restores, Event, 'findById', async id => buildEvent({
            id,
            status: 'published',
            organizerId: 'user-1',
            calendarLink: 'https://calendar.google.com/calendar/event?eid=calendar-event-broken',
            calendarEventId: 'calendar-event-broken',
        }));
        const publishedEventBeforeDeleteFailure = buildEvent({
            id: 'event-4',
            status: 'published',
            organizerId: 'user-1',
            calendarLink: 'https://calendar.google.com/calendar/event?eid=calendar-event-broken',
            calendarEventId: 'calendar-event-broken',
        });
        trackReplacement(restores, GoogleCalendarPublisher, 'deleteEvent', async () => {
            throw new Error('calendar delete failed');
        });
        const deleteFailureUpdateDetails = jest.fn(async (id, payload) => buildEvent({ id, ...payload, organizerId: 'user-1' }));
        trackReplacement(restores, Event, 'updateDetails', deleteFailureUpdateDetails);
        const calendarFailureNext = jest.fn();
        await runRouteHandlers(updateHandlers, createRequest({
            user: buildUser({ id: 'admin-1', role: 'admin', name: 'Grace Hopper' }),
            params: { id: 'event-4' },
            body: { title: 'Novo', description: 'Resumo', date: '2026-06-10T19:00:00.000Z' },
        }), createResponseDouble(), calendarFailureNext);
        expect(calendarFailureNext.mock.calls[0][0].status).toBe(500);
        expect(deleteFailureUpdateDetails).toHaveBeenCalledTimes(1);
        expect(deleteFailureUpdateDetails.mock.calls[0]).toEqual(['event-4', {
            title: 'Novo',
            description: 'Resumo',
            date: '2026-06-10T19:00:00.000Z',
            category: 'outro',
            location: 'A definir',
            status: 'pending',
            rejectionReason: null,
            calendarLink: publishedEventBeforeDeleteFailure.calendarLink,
            calendarEventId: publishedEventBeforeDeleteFailure.calendarEventId,
        }]);
        expect(notificationCalls).toHaveLength(1);

        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'rejected', organizerId: 'user-1' }));
        trackReplacement(restores, Event, 'updateDetails', async () => {
            throw new Error('write failed');
        });
        const errorNext = jest.fn();
        await runRouteHandlers(updateHandlers, createRequest({ user: { id: 'user-1' }, params: { id: 'event-1' }, body: { title: 'Novo', description: 'Resumo', date: '2026-06-10T19:00:00.000Z' } }), createResponseDouble(), errorNext);
        expect(errorNext.mock.calls[0][0].status).toBe(500);
    });

    test('update lets organizers resubmit rejected events through the pending flow', async () => {
        const updateDetails = jest.fn(async (id, payload) => buildEvent({ id, ...payload, organizerId: 'user-1' }));
        const notifyPendingApproval = jest.fn(async payload => ({ sentCount: 1, event: payload.event }));

        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'rejected', organizerId: 'user-1' }));
        trackReplacement(restores, Event, 'updateDetails', updateDetails);
        trackReplacement(restores, PendingEventNotificationManager.prototype, 'notifyPendingApproval', notifyPendingApproval);
        trackReplacement(restores, EventUpdateNotificationManager.prototype, 'notifyEventUpdated', async () => ({ sentCount: 0 }));

        const res = createResponseDouble();
        const next = jest.fn();
        await runRouteHandlers(updateHandlers, createRequest({
            user: buildUser({ id: 'user-1' }),
            params: { id: 'event-rejected-1' },
            body: {
                title: 'Evento reenviado',
                description: 'Ajustes solicitados pela moderação.',
                date: '2026-06-26T19:00:00.000Z',
            },
        }), res, next);

        expect(next).not.toHaveBeenCalled();
        expect(updateDetails).toHaveBeenCalledWith('event-rejected-1', {
            title: 'Evento reenviado',
            description: 'Ajustes solicitados pela moderação.',
            date: '2026-06-26T19:00:00.000Z',
            category: 'outro',
            location: 'A definir',
            status: 'pending',
            rejectionReason: null,
            calendarLink: null,
            calendarEventId: null,
        });
        expect(notifyPendingApproval).toHaveBeenCalledTimes(1);
        expect(res.body.message).toBe('Evento atualizado e enviado para moderação.');
    });

    test('update lets administrators edit any event, moves it to pending, and notifies the owner', async () => {
        const updateDetails = jest.fn()
            .mockResolvedValueOnce(buildEvent({
                id: 'event-admin-1',
                title: 'Evento ajustado pela moderação',
                description: 'Nova descrição depois do ajuste administrativo.',
                date: '2026-06-28T19:00:00.000Z',
                category: 'outro',
                location: 'A definir',
                status: 'pending',
                organizerId: 'user-2',
                calendarLink: 'https://calendar.google.com/calendar/event?eid=calendar-event-admin-1',
                calendarEventId: 'calendar-event-admin-1',
            }))
            .mockResolvedValueOnce(buildEvent({
                id: 'event-admin-1',
                title: 'Evento ajustado pela moderação',
                description: 'Nova descrição depois do ajuste administrativo.',
                date: '2026-06-28T19:00:00.000Z',
                category: 'outro',
                location: 'A definir',
                status: 'pending',
                organizerId: 'user-2',
                calendarLink: null,
                calendarEventId: null,
            }));
        const deleteEvent = jest.fn(async () => undefined);
        const notifyPendingApproval = jest.fn(async () => ({ sentCount: 1 }));
        const notifyEventUpdated = jest.fn(async payload => ({ sentCount: 1, event: payload.event }));

        trackReplacement(restores, Event, 'findById', async id => buildEvent({
            id,
            status: 'published',
            organizerId: 'user-2',
            organizerName: 'Ada Lovelace',
            calendarLink: 'https://calendar.google.com/calendar/event?eid=calendar-event-admin-1',
            calendarEventId: 'calendar-event-admin-1',
        }));
        trackReplacement(restores, Event, 'updateDetails', updateDetails);
        trackReplacement(restores, GoogleCalendarPublisher, 'deleteEvent', deleteEvent);
        trackReplacement(restores, PendingEventNotificationManager.prototype, 'notifyPendingApproval', notifyPendingApproval);
        trackReplacement(restores, EventUpdateNotificationManager.prototype, 'notifyEventUpdated', notifyEventUpdated);
        trackReplacement(restores, User, 'findById', async id => buildUser({ id, name: 'Ada Lovelace', email: 'ada@example.com' }));

        const res = createResponseDouble();
        const next = jest.fn();
        await runRouteHandlers(updateHandlers, createRequest({
            user: buildUser({ id: 'admin-1', role: 'admin', name: 'Grace Hopper' }),
            params: { id: 'event-admin-1' },
            body: {
                title: 'Evento ajustado pela moderação',
                description: 'Nova descrição depois do ajuste administrativo.',
                date: '2026-06-28T19:00:00.000Z',
            },
        }), res, next);

        expect(next).not.toHaveBeenCalled();
        expect(updateDetails.mock.calls).toEqual([
            ['event-admin-1', {
                title: 'Evento ajustado pela moderação',
                description: 'Nova descrição depois do ajuste administrativo.',
                date: '2026-06-28T19:00:00.000Z',
                category: 'outro',
                location: 'A definir',
                status: 'pending',
                rejectionReason: null,
                calendarLink: 'https://calendar.google.com/calendar/event?eid=calendar-event-admin-1',
                calendarEventId: 'calendar-event-admin-1',
            }],
            ['event-admin-1', {
                calendarLink: null,
                calendarEventId: null,
            }],
        ]);
        expect(deleteEvent).toHaveBeenCalledWith('calendar-event-admin-1');
        expect(notifyPendingApproval).not.toHaveBeenCalled();
        expect(notifyEventUpdated).toHaveBeenCalledWith({
            event: expect.objectContaining({
                id: 'event-admin-1',
                status: 'pending',
                calendarLink: null,
                calendarEventId: null,
            }),
            owner: expect.objectContaining({
                id: 'user-2',
                email: 'ada@example.com',
            }),
            editor: expect.objectContaining({
                id: 'admin-1',
                role: 'admin',
            }),
        });
        expect(res.body.message).toBe('Evento atualizado e enviado para moderação.');
    });

    test('update keeps administrator edits successful when owner notification delivery fails', async () => {
        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'pending', organizerId: 'user-2' }));
        trackReplacement(restores, Event, 'updateDetails', async (id, payload) => buildEvent({ id, ...payload, organizerId: 'user-2' }));
        trackReplacement(restores, User, 'findById', async id => buildUser({ id, email: 'ada@example.com' }));
        trackReplacement(restores, EventUpdateNotificationManager.prototype, 'notifyEventUpdated', async () => {
            throw new Error('smtp timeout');
        });
        trackReplacement(restores, PendingEventNotificationManager.prototype, 'notifyPendingApproval', async () => ({ sentCount: 0 }));

        const errorLog = jest.fn();
        trackReplacement(restores, console, 'error', errorLog);

        const res = createResponseDouble();
        const next = jest.fn();
        await runRouteHandlers(updateHandlers, createRequest({
            user: buildUser({ id: 'admin-1', role: 'admin', name: 'Grace Hopper' }),
            params: { id: 'event-admin-2' },
            body: {
                title: 'Evento em moderação',
                description: 'Ajuste administrativo sem calendário ativo.',
                date: '2026-06-30T19:00:00.000Z',
            },
        }), res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe('Evento atualizado e enviado para moderação.');
        expect(errorLog).toHaveBeenCalledWith('Failed to send event-update owner notification:', expect.any(Error));
    });

    test('update does not delete the calendar entry when a published edit fails to persist', async () => {
        trackReplacement(restores, Event, 'findById', async id => buildEvent({
            id,
            status: 'published',
            organizerId: 'user-2',
            calendarLink: 'https://calendar.google.com/calendar/event?eid=calendar-event-locked',
            calendarEventId: 'calendar-event-locked',
        }));

        const deleteEvent = jest.fn(async () => undefined);
        trackReplacement(restores, GoogleCalendarPublisher, 'deleteEvent', deleteEvent);
        trackReplacement(restores, Event, 'updateDetails', async () => {
            throw new Error('write failed');
        });

        const next = jest.fn();
        await runRouteHandlers(updateHandlers, createRequest({
            user: buildUser({ id: 'admin-1', role: 'admin', name: 'Grace Hopper' }),
            params: { id: 'event-5' },
            body: {
                title: 'Titulo ajustado',
                description: 'Conteudo revisado',
                date: '2026-06-18T19:00:00.000Z',
            },
        }), createResponseDouble(), next);

        expect(next.mock.calls[0][0].status).toBe(500);
        expect(deleteEvent).not.toHaveBeenCalled();
    });

    test('update preserves stored calendar identifiers until the cleanup write succeeds', async () => {
        const currentEvent = buildEvent({
            id: 'event-6',
            status: 'published',
            organizerId: 'user-2',
            calendarLink: 'https://calendar.google.com/calendar/event?eid=calendar-event-sticky',
            calendarEventId: 'calendar-event-sticky',
        });

        trackReplacement(restores, Event, 'findById', async () => currentEvent);

        const updateDetails = jest.fn()
            .mockResolvedValueOnce(buildEvent({
                id: currentEvent.id,
                title: 'Titulo revisado',
                description: 'Conteudo revisado',
                date: '2026-06-20T19:00:00.000Z',
                category: 'outro',
                location: 'A definir',
                status: 'pending',
                organizerId: 'user-1',
                calendarLink: currentEvent.calendarLink,
                calendarEventId: currentEvent.calendarEventId,
            }))
            .mockRejectedValueOnce(new Error('clear failed'));
        trackReplacement(restores, Event, 'updateDetails', updateDetails);

        const deleteEvent = jest.fn(async () => undefined);
        trackReplacement(restores, GoogleCalendarPublisher, 'deleteEvent', deleteEvent);

        const notifyPendingApproval = jest.fn(async () => ({ sentCount: 1 }));
        trackReplacement(restores, PendingEventNotificationManager.prototype, 'notifyPendingApproval', notifyPendingApproval);

        const next = jest.fn();
        await runRouteHandlers(updateHandlers, createRequest({
            user: buildUser({ id: 'admin-1', role: 'admin', name: 'Grace Hopper' }),
            params: { id: currentEvent.id },
            body: {
                title: 'Titulo revisado',
                description: 'Conteudo revisado',
                date: '2026-06-20T19:00:00.000Z',
            },
        }), createResponseDouble(), next);

        expect(next.mock.calls[0][0].status).toBe(500);
        expect(updateDetails).toHaveBeenCalledTimes(2);
        expect(updateDetails.mock.calls[0]).toEqual([currentEvent.id, {
            title: 'Titulo revisado',
            description: 'Conteudo revisado',
            date: '2026-06-20T19:00:00.000Z',
            category: 'outro',
            location: 'A definir',
            status: 'pending',
            rejectionReason: null,
            calendarLink: currentEvent.calendarLink,
            calendarEventId: currentEvent.calendarEventId,
        }]);
        expect(deleteEvent).toHaveBeenCalledWith(currentEvent.calendarEventId);
        expect(updateDetails.mock.calls[1]).toEqual([currentEvent.id, {
            calendarLink: null,
            calendarEventId: null,
        }]);
        expect(notifyPendingApproval).not.toHaveBeenCalled();
    });

    test('update retries calendar deletion after a prior delete failure before clearing metadata and re-notifying admins', async () => {
        const currentEvent = buildEvent({
            id: 'event-7',
            status: 'pending',
            organizerId: 'user-1',
            calendarLink: 'https://calendar.google.com/calendar/event?eid=calendar-event-retry',
            calendarEventId: 'calendar-event-retry',
        });

        trackReplacement(restores, Event, 'findById', async () => currentEvent);

        const updateDetails = jest.fn()
            .mockResolvedValueOnce(buildEvent({
                id: currentEvent.id,
                title: 'Titulo retrabalhado',
                description: 'Conteudo corrigido depois da falha de exclusao',
                date: '2026-06-22T19:00:00.000Z',
                category: 'outro',
                location: 'A definir',
                status: 'pending',
                organizerId: 'user-1',
                calendarLink: currentEvent.calendarLink,
                calendarEventId: currentEvent.calendarEventId,
            }))
            .mockResolvedValueOnce(buildEvent({
                id: currentEvent.id,
                title: 'Titulo retrabalhado',
                description: 'Conteudo corrigido depois da falha de exclusao',
                date: '2026-06-22T19:00:00.000Z',
                category: 'outro',
                location: 'A definir',
                status: 'pending',
                organizerId: 'user-1',
                calendarLink: null,
                calendarEventId: null,
            }));
        trackReplacement(restores, Event, 'updateDetails', updateDetails);

        const deleteEvent = jest.fn(async () => undefined);
        trackReplacement(restores, GoogleCalendarPublisher, 'deleteEvent', deleteEvent);

        const notifyPendingApproval = jest.fn(async payload => ({ sentCount: 1, event: payload.event }));
        trackReplacement(restores, PendingEventNotificationManager.prototype, 'notifyPendingApproval', notifyPendingApproval);

        const res = createResponseDouble();
        const next = jest.fn();
        await runRouteHandlers(updateHandlers, createRequest({
            user: buildUser({ id: 'user-1' }),
            params: { id: currentEvent.id },
            body: {
                title: 'Titulo retrabalhado',
                description: 'Conteudo corrigido depois da falha de limpeza',
                date: '2026-06-22T19:00:00.000Z',
            },
        }), res, next);

        expect(next).not.toHaveBeenCalled();
        expect(updateDetails).toHaveBeenCalledTimes(2);
        expect(updateDetails.mock.calls[0]).toEqual([currentEvent.id, {
            title: 'Titulo retrabalhado',
            description: 'Conteudo corrigido depois da falha de limpeza',
            date: '2026-06-22T19:00:00.000Z',
            category: 'outro',
            location: 'A definir',
            status: 'pending',
            rejectionReason: null,
            calendarLink: currentEvent.calendarLink,
            calendarEventId: currentEvent.calendarEventId,
        }]);
        expect(deleteEvent).toHaveBeenCalledTimes(1);
        expect(deleteEvent).toHaveBeenCalledWith(currentEvent.calendarEventId);
        expect(updateDetails.mock.calls[1]).toEqual([currentEvent.id, {
            calendarLink: null,
            calendarEventId: null,
        }]);
        expect(notifyPendingApproval).toHaveBeenCalledTimes(1);
        expect(notifyPendingApproval).toHaveBeenCalledWith({
            event: expect.objectContaining({
                id: currentEvent.id,
                status: 'pending',
                calendarLink: null,
                calendarEventId: null,
            }),
            organizer: expect.objectContaining({
                id: 'user-1',
            }),
        });
        expect(res.body.message).toBe('Evento atualizado e enviado para moderação.');
    });

    test('update treats an already-deleted calendar entry as successful cleanup on retry and re-notifies admins', async () => {
        const currentEvent = buildEvent({
            id: 'event-8',
            status: 'pending',
            organizerId: 'user-1',
            calendarLink: 'https://calendar.google.com/calendar/event?eid=calendar-event-stale',
            calendarEventId: 'calendar-event-stale',
        });

        trackReplacement(restores, Event, 'findById', async () => currentEvent);

        const updateDetails = jest.fn()
            .mockResolvedValueOnce(buildEvent({
                id: currentEvent.id,
                title: 'Titulo retrabalhado',
                description: 'Conteudo corrigido depois da falha de limpeza',
                date: '2026-06-24T19:00:00.000Z',
                category: 'outro',
                location: 'A definir',
                status: 'pending',
                organizerId: 'user-1',
                calendarLink: currentEvent.calendarLink,
                calendarEventId: currentEvent.calendarEventId,
            }))
            .mockResolvedValueOnce(buildEvent({
                id: currentEvent.id,
                title: 'Titulo retrabalhado',
                description: 'Conteudo corrigido depois da falha de limpeza',
                date: '2026-06-24T19:00:00.000Z',
                category: 'outro',
                location: 'A definir',
                status: 'pending',
                organizerId: 'user-1',
                calendarLink: null,
                calendarEventId: null,
            }));
        trackReplacement(restores, Event, 'updateDetails', updateDetails);

        const deleteEvent = jest.fn(async () => {
            const error = new Error('Event not found');
            error.code = 404;
            throw error;
        });
        trackReplacement(restores, GoogleCalendarPublisher, 'deleteEvent', deleteEvent);

        const notifyPendingApproval = jest.fn(async payload => ({ sentCount: 1, event: payload.event }));
        trackReplacement(restores, PendingEventNotificationManager.prototype, 'notifyPendingApproval', notifyPendingApproval);

        const res = createResponseDouble();
        const next = jest.fn();
        await runRouteHandlers(updateHandlers, createRequest({
            user: buildUser({ id: 'user-1' }),
            params: { id: currentEvent.id },
            body: {
                title: 'Titulo retrabalhado',
                description: 'Conteudo corrigido depois da falha de limpeza',
                date: '2026-06-24T19:00:00.000Z',
            },
        }), res, next);

        expect(next).not.toHaveBeenCalled();
        expect(updateDetails).toHaveBeenCalledTimes(2);
        expect(updateDetails.mock.calls[0]).toEqual([currentEvent.id, {
            title: 'Titulo retrabalhado',
            description: 'Conteudo corrigido depois da falha de limpeza',
            date: '2026-06-24T19:00:00.000Z',
            category: 'outro',
            location: 'A definir',
            status: 'pending',
            rejectionReason: null,
            calendarLink: currentEvent.calendarLink,
            calendarEventId: currentEvent.calendarEventId,
        }]);
        expect(deleteEvent).toHaveBeenCalledTimes(1);
        expect(deleteEvent).toHaveBeenCalledWith(currentEvent.calendarEventId);
        expect(updateDetails.mock.calls[1]).toEqual([currentEvent.id, {
            calendarLink: null,
            calendarEventId: null,
        }]);
        expect(notifyPendingApproval).toHaveBeenCalledTimes(1);
        expect(notifyPendingApproval).toHaveBeenCalledWith({
            event: expect.objectContaining({
                id: currentEvent.id,
                status: 'pending',
                calendarLink: null,
                calendarEventId: null,
            }),
            organizer: expect.objectContaining({
                id: 'user-1',
            }),
        });
        expect(res.body.message).toBe('Evento atualizado e enviado para moderação.');
    });

    test('delete enforces ownership, keeps approved owner deletions forbidden, allows admin deletions with owner email, and wraps failures', async () => {
        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'pending', organizerId: 'user-1' }));
        const removeCalls = [];
        const calendarDeleteCalls = [];
        const ownerNotificationCalls = [];
        trackReplacement(restores, Event, 'remove', async id => {
            removeCalls.push(id);
        });
        trackReplacement(restores, GoogleCalendarPublisher, 'deleteEvent', async calendarEventId => {
            calendarDeleteCalls.push(calendarEventId);
        });
        trackReplacement(restores, EventUpdateNotificationManager.prototype, 'notifyEventDeleted', async payload => {
            ownerNotificationCalls.push(payload);
            return { sentCount: 1 };
        });
        trackReplacement(restores, User, 'findById', async id => buildUser({ id, email: 'owner@example.com', name: 'Owner User' }));

        const successRes = createResponseDouble();
        const successNext = jest.fn();
        await runRouteHandlers(deleteHandlers, createRequest({ user: { id: 'user-1' }, params: { id: 'event-1' } }), successRes, successNext);
        expect(successNext).not.toHaveBeenCalled();
        expect(removeCalls).toEqual(['event-1']);
        expect(calendarDeleteCalls).toEqual([]);
        expect(successRes.body.message).toBe('Evento excluído com sucesso.');
        expect(ownerNotificationCalls).toEqual([]);

        trackReplacement(restores, Event, 'findById', async id => buildEvent({
            id,
            status: 'published',
            organizerId: 'user-1',
            calendarEventId: 'calendar-event-1',
            calendarLink: 'https://calendar.google.com/calendar/event?eid=abc123',
        }));
        const publishedDeleteNext = jest.fn();
        await runRouteHandlers(deleteHandlers, createRequest({ user: { id: 'user-1' }, params: { id: 'event-2' } }), createResponseDouble(), publishedDeleteNext);
        expect(publishedDeleteNext.mock.calls[0][0].status).toBe(403);
        expect(removeCalls).toEqual(['event-1']);
        expect(calendarDeleteCalls).toEqual([]);

        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'pending', organizerId: 'other-user' }));
        const forbiddenNext = jest.fn();
        await runRouteHandlers(deleteHandlers, createRequest({ user: { id: 'user-1' }, params: { id: 'event-1' } }), createResponseDouble(), forbiddenNext);
        expect(forbiddenNext.mock.calls[0][0].status).toBe(403);

        trackReplacement(restores, Event, 'findById', async id => buildEvent({
            id,
            status: 'published',
            organizerId: 'user-2',
            calendarEventId: 'calendar-event-admin-1',
            calendarLink: 'https://calendar.google.com/calendar/event?eid=admin-delete',
        }));
        const adminDeleteRes = createResponseDouble();
        const adminDeleteNext = jest.fn();
        await runRouteHandlers(deleteHandlers, createRequest({ user: buildUser({ id: 'admin-1', role: 'admin', name: 'Grace Hopper' }), params: { id: 'event-2' } }), adminDeleteRes, adminDeleteNext);
        expect(adminDeleteNext).not.toHaveBeenCalled();
        expect(removeCalls).toEqual(['event-1', 'event-2']);
        expect(calendarDeleteCalls).toEqual(['calendar-event-admin-1']);
        expect(ownerNotificationCalls).toEqual([{
            event: expect.objectContaining({
                id: 'event-2',
                organizerId: 'user-2',
            }),
            owner: expect.objectContaining({
                id: 'user-2',
                email: 'owner@example.com',
            }),
            editor: expect.objectContaining({
                id: 'admin-1',
                role: 'admin',
            }),
        }]);
        expect(adminDeleteRes.body.message).toBe('Evento excluído com sucesso.');

        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'rejected', organizerId: 'user-1' }));
        trackReplacement(restores, Event, 'remove', async () => {
            throw new Error('delete failed');
        });
        const errorNext = jest.fn();
        await runRouteHandlers(deleteHandlers, createRequest({ user: { id: 'user-1' }, params: { id: 'event-1' } }), createResponseDouble(), errorNext);
        expect(errorNext.mock.calls[0][0].status).toBe(500);

        trackReplacement(restores, Event, 'findById', async id => buildEvent({
            id,
            status: 'published',
            organizerId: 'user-2',
            calendarEventId: 'calendar-event-2',
        }));
        trackReplacement(restores, Event, 'remove', async id => {
            removeCalls.push(id);
        });
        trackReplacement(restores, GoogleCalendarPublisher, 'deleteEvent', async () => {
            throw new Error('calendar delete failed');
        });
        const calendarFailureLog = jest.fn();
        trackReplacement(restores, console, 'error', calendarFailureLog);
        const calendarFailureRes = createResponseDouble();
        const calendarFailureNext = jest.fn();
        await runRouteHandlers(deleteHandlers, createRequest({ user: buildUser({ id: 'admin-1', role: 'admin', name: 'Grace Hopper' }), params: { id: 'event-3' } }), calendarFailureRes, calendarFailureNext);
        expect(calendarFailureNext).not.toHaveBeenCalled();
        expect(calendarFailureRes.body.message).toBe('Evento excluído com sucesso.');
        expect(calendarFailureLog).toHaveBeenCalledWith('Failed to delete calendar entry after event removal:', expect.any(Error));
    });

    test('moderation decisions enforce admin rules, validate statuses, and wrap failures', async () => {
        const statusCalls = [];
        const deleteCalls = [];
        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'pending', organizerId: 'user-2' }));
        trackReplacement(restores, User, 'findById', async id => buildUser({ id, email: 'owner@example.com', name: 'Owner User' }));
        trackReplacement(restores, EventUpdateNotificationManager.prototype, 'notifyEventApproved', async () => ({ sentCount: 1 }));
        trackReplacement(restores, EventUpdateNotificationManager.prototype, 'notifyEventRejected', async () => ({ sentCount: 1 }));
        trackReplacement(restores, GoogleCalendarPublisher, 'publishApprovedEvent', async () => ({
            id: 'calendar-event-1',
            htmlLink: 'https://calendar.google.com/calendar/event?eid=abc123',
        }));
        trackReplacement(restores, GoogleCalendarPublisher, 'deleteEvent', async id => {
            deleteCalls.push(id);
        });
        trackReplacement(restores, Event, 'updateStatus', async (id, status, options) => {
            statusCalls.push({ id, status, options });
            return buildEvent({
                id,
                status,
                organizerId: 'user-2',
                rejectionReason: options?.rejectionReason ?? null,
                calendarLink: options?.calendarLink ?? null,
                calendarEventId: options?.calendarEventId ?? null,
            });
        });

        const publishRes = createResponseDouble();
        const publishNext = jest.fn();
        await runRouteHandlers(moderationDecisionHandlers, createRequest({ user: { id: 'admin-1', role: 'admin' }, params: { id: 'event-1' }, body: { status: 'published' } }), publishRes, publishNext);
        expect(publishNext).not.toHaveBeenCalled();
        expect(statusCalls).toEqual([{
            id: 'event-1',
            status: 'published',
            options: {
                rejectionReason: null,
                calendarLink: 'https://calendar.google.com/calendar/event?eid=abc123',
                calendarEventId: 'calendar-event-1',
            },
        }]);
        expect(publishRes.body.message).toBe('Evento aprovado e publicado.');
        expect(deleteCalls).toEqual([]);

        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'pending', organizerId: 'user-2' }));
        trackReplacement(restores, Event, 'updateStatus', async (id, status, options) => {
            statusCalls.push({ id, status, options });
            return buildEvent({
                id,
                status,
                organizerId: 'user-2',
                rejectionReason: options?.rejectionReason ?? null,
                calendarLink: options?.calendarLink ?? null,
                calendarEventId: options?.calendarEventId ?? null,
            });
        });

        const rejectRes = createResponseDouble();
        const rejectNext = jest.fn();
        await runRouteHandlers(moderationDecisionHandlers, createRequest({
            user: { id: 'admin-1', role: 'admin' },
            params: { id: 'event-2' },
            body: { status: 'rejected', rejectionReason: '  Ajuste a descrição do público-alvo. ' },
        }), rejectRes, rejectNext);
        expect(rejectNext).not.toHaveBeenCalled();
        expect(statusCalls.at(-1)).toEqual({
            id: 'event-2',
            status: 'rejected',
            options: {
                rejectionReason: 'Ajuste a descrição do público-alvo.',
                calendarLink: null,
                calendarEventId: null,
            },
        });
        expect(rejectRes.body.message).toBe('Evento rejeitado.');

        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'pending', organizerId: 'admin-1' }));
        const selfModerationRes = createResponseDouble();
        const selfModerationNext = jest.fn();
        await runRouteHandlers(
            moderationDecisionHandlers,
            createRequest({ user: { id: 'admin-1', role: 'admin' }, params: { id: 'event-1' }, body: { status: 'published' } }),
            selfModerationRes,
            selfModerationNext,
        );
        expect(selfModerationNext).not.toHaveBeenCalled();
        expect(selfModerationRes.body.message).toBe('Evento aprovado e publicado.');

        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'published', organizerId: 'user-2' }));
        const publishedNext = jest.fn();
        await runRouteHandlers(moderationDecisionHandlers, createRequest({ user: { id: 'admin-1', role: 'admin' }, params: { id: 'event-1' }, body: { status: 'rejected' } }), createResponseDouble(), publishedNext);
        expect(publishedNext.mock.calls[0][0].status).toBe(400);

        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'rejected', organizerId: 'user-2' }));
        const rejectedNext = jest.fn();
        await runRouteHandlers(moderationDecisionHandlers, createRequest({ user: { id: 'admin-1', role: 'admin' }, params: { id: 'event-3' }, body: { status: 'published' } }), createResponseDouble(), rejectedNext);
        expect(rejectedNext.mock.calls[0][0].status).toBe(400);
        expect(rejectedNext.mock.calls[0][0].message).toBe('Somente eventos pendentes podem ser moderados.');

        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'pending', organizerId: 'user-2' }));
        const invalidStatusNext = jest.fn();
        await runRouteHandlers(moderationDecisionHandlers, createRequest({ user: { id: 'admin-1', role: 'admin' }, params: { id: 'event-1' }, body: { status: 'pending' } }), createResponseDouble(), invalidStatusNext);
        expect(invalidStatusNext.mock.calls[0][0].status).toBe(400);

        const nonAdminNext = jest.fn();
        await runRouteHandlers(moderationDecisionHandlers, createRequest({ user: { id: 'user-1', role: 'member' }, params: { id: 'event-1' }, body: { status: 'published' } }), createResponseDouble(), nonAdminNext);
        expect(nonAdminNext.mock.calls[0][0].status).toBe(403);

        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'pending', organizerId: 'user-2' }));
        trackReplacement(restores, GoogleCalendarPublisher, 'publishApprovedEvent', async () => {
            throw new Error('calendar failed');
        });
        const calendarErrorNext = jest.fn();
        await runRouteHandlers(moderationDecisionHandlers, createRequest({ user: { id: 'admin-1', role: 'admin' }, params: { id: 'event-1' }, body: { status: 'published' } }), createResponseDouble(), calendarErrorNext);
        expect(calendarErrorNext.mock.calls[0][0].status).toBe(500);

        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'pending', organizerId: 'user-2' }));
        trackReplacement(restores, GoogleCalendarPublisher, 'publishApprovedEvent', async () => ({
            id: 'calendar-event-rollback',
            htmlLink: 'https://calendar.google.com/calendar/event?eid=rollback',
        }));
        trackReplacement(restores, Event, 'updateStatus', async () => {
            throw new Error('write failed');
        });
        const errorNext = jest.fn();
        await runRouteHandlers(moderationDecisionHandlers, createRequest({ user: { id: 'admin-1', role: 'admin' }, params: { id: 'event-1' }, body: { status: 'published' } }), createResponseDouble(), errorNext);
        expect(errorNext.mock.calls[0][0].status).toBe(500);
        expect(deleteCalls).toEqual(['calendar-event-rollback']);
    });

    test('moderation decisions notify the owner on approval and rejection', async () => {
        const notifyEventApproved = jest.fn(async payload => ({ sentCount: 1, event: payload.event }));
        const notifyEventRejected = jest.fn(async payload => ({ sentCount: 1, event: payload.event }));

        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'pending', organizerId: 'user-2' }));
        trackReplacement(restores, User, 'findById', async id => buildUser({ id, email: 'owner@example.com', name: 'Owner User' }));
        trackReplacement(restores, GoogleCalendarPublisher, 'publishApprovedEvent', async () => ({
            id: 'calendar-event-owner-1',
            htmlLink: 'https://calendar.google.com/calendar/event?eid=owner-1',
        }));
        trackReplacement(restores, Event, 'updateStatus', async (id, status, options) => buildEvent({
            id,
            status,
            organizerId: 'user-2',
            rejectionReason: options?.rejectionReason ?? null,
            calendarLink: options?.calendarLink ?? null,
            calendarEventId: options?.calendarEventId ?? null,
        }));
        trackReplacement(restores, EventUpdateNotificationManager.prototype, 'notifyEventApproved', notifyEventApproved);
        trackReplacement(restores, EventUpdateNotificationManager.prototype, 'notifyEventRejected', notifyEventRejected);

        const publishRes = createResponseDouble();
        const publishNext = jest.fn();
        await runRouteHandlers(moderationDecisionHandlers, createRequest({
            user: buildUser({ id: 'admin-1', role: 'admin', name: 'Grace Hopper' }),
            params: { id: 'event-approved-1' },
            body: { status: 'published' },
        }), publishRes, publishNext);

        expect(publishNext).not.toHaveBeenCalled();
        expect(notifyEventApproved).toHaveBeenCalledWith({
            event: expect.objectContaining({
                id: 'event-approved-1',
                status: 'published',
                calendarEventId: 'calendar-event-owner-1',
            }),
            owner: expect.objectContaining({
                id: 'user-2',
                email: 'owner@example.com',
            }),
            editor: expect.objectContaining({
                id: 'admin-1',
                role: 'admin',
            }),
        });
        expect(notifyEventRejected).not.toHaveBeenCalled();
        expect(publishRes.body.message).toBe('Evento aprovado e publicado.');

        notifyEventApproved.mockClear();
        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'pending', organizerId: 'user-2' }));
        trackReplacement(restores, Event, 'updateStatus', async (id, status, options) => buildEvent({
            id,
            status,
            organizerId: 'user-2',
            rejectionReason: options?.rejectionReason ?? null,
            calendarLink: options?.calendarLink ?? null,
            calendarEventId: options?.calendarEventId ?? null,
        }));

        const rejectRes = createResponseDouble();
        const rejectNext = jest.fn();
        await runRouteHandlers(moderationDecisionHandlers, createRequest({
            user: buildUser({ id: 'admin-1', role: 'admin', name: 'Grace Hopper' }),
            params: { id: 'event-rejected-1' },
            body: { status: 'rejected', rejectionReason: 'Inclua mais detalhes sobre o público.' },
        }), rejectRes, rejectNext);

        expect(rejectNext).not.toHaveBeenCalled();
        expect(notifyEventApproved).not.toHaveBeenCalled();
        expect(notifyEventRejected).toHaveBeenCalledWith({
            event: expect.objectContaining({
                id: 'event-rejected-1',
                status: 'rejected',
                rejectionReason: 'Inclua mais detalhes sobre o público.',
            }),
            owner: expect.objectContaining({
                id: 'user-2',
                email: 'owner@example.com',
            }),
            editor: expect.objectContaining({
                id: 'admin-1',
                role: 'admin',
            }),
        });
        expect(rejectRes.body.message).toBe('Evento rejeitado.');
    });

    test('moderation decisions stay successful when owner notification delivery fails', async () => {
        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'pending', organizerId: 'user-2' }));
        trackReplacement(restores, User, 'findById', async id => buildUser({ id, email: 'owner@example.com', name: 'Owner User' }));
        trackReplacement(restores, GoogleCalendarPublisher, 'publishApprovedEvent', async () => ({
            id: 'calendar-event-owner-2',
            htmlLink: 'https://calendar.google.com/calendar/event?eid=owner-2',
        }));
        trackReplacement(restores, Event, 'updateStatus', async (id, status, options) => buildEvent({
            id,
            status,
            organizerId: 'user-2',
            rejectionReason: options?.rejectionReason ?? null,
            calendarLink: options?.calendarLink ?? null,
            calendarEventId: options?.calendarEventId ?? null,
        }));
        trackReplacement(restores, EventUpdateNotificationManager.prototype, 'notifyEventApproved', async () => {
            throw new Error('smtp timeout');
        });
        trackReplacement(restores, EventUpdateNotificationManager.prototype, 'notifyEventRejected', async () => ({ sentCount: 0 }));

        const errorLog = jest.fn();
        trackReplacement(restores, console, 'error', errorLog);

        const res = createResponseDouble();
        const next = jest.fn();
        await runRouteHandlers(moderationDecisionHandlers, createRequest({
            user: buildUser({ id: 'admin-1', role: 'admin', name: 'Grace Hopper' }),
            params: { id: 'event-approved-2' },
            body: { status: 'published' },
        }), res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe('Evento aprovado e publicado.');
        expect(errorLog).toHaveBeenCalledWith('Failed to send event-approval owner notification:', expect.any(Error));
    });
});