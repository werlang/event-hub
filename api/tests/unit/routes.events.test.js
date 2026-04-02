import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { router as eventsRouter } from '../../routes/events.js';
import { Event } from '../../model/event.js';
import { buildEvent } from './support/fixtures.js';
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
            return [buildEvent({ status: 'published' })];
        });

        const res = createResponseDouble();
        const next = jest.fn();
        await runRouteHandlers(listHandlers, createRequest({ query: { q: 'comp', category: 'Tecnologia', from: '2026-05-01', to: '2026-05-31' } }), res, next);

        expect(next).not.toHaveBeenCalled();
        expect(calls).toEqual([{ search: 'comp', category: 'Tecnologia', from: '2026-05-01', to: '2026-05-31' }]);
        expect(res.body.data.events).toHaveLength(1);
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
            return [buildEvent({ status: 'pending' })];
        });

        const successRes = createResponseDouble();
        const successNext = jest.fn();
        await runRouteHandlers(moderationListHandlers, createRequest({ user: { id: 'admin-1', role: 'admin' }, query: { status: 'rejected' } }), successRes, successNext);
        expect(successNext).not.toHaveBeenCalled();
        expect(calls).toEqual([{ moderatorId: undefined, status: 'rejected' }]);

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
        trackReplacement(restores, Event, 'create', async payload => {
            createCalls.push(payload);
            return buildEvent({ ...payload, status: 'pending' });
        });

        const successRes = createResponseDouble();
        const successNext = jest.fn();
        await runRouteHandlers(createHandlers, createRequest({
            user: { id: 'user-1' },
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

    test('update enforces ownership and manageable statuses, resubmits for moderation, and wraps failures', async () => {
        const updateCalls = [];
        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'rejected', organizerId: 'user-1' }));
        trackReplacement(restores, Event, 'updateDetails', async (id, payload) => {
            updateCalls.push({ id, payload });
            return buildEvent({ id, ...payload, organizerId: 'user-1' });
        });

        const successRes = createResponseDouble();
        const successNext = jest.fn();
        await runRouteHandlers(updateHandlers, createRequest({
            user: { id: 'user-1' },
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
            },
        });

        trackReplacement(restores, Event, 'findById', async () => null);
        const missingNext = jest.fn();
        await runRouteHandlers(updateHandlers, createRequest({ user: { id: 'user-1' }, params: { id: 'event-1' }, body: { title: 'Novo', description: 'Resumo', date: '2026-06-10T19:00:00.000Z' } }), createResponseDouble(), missingNext);
        expect(missingNext.mock.calls[0][0].status).toBe(404);

        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'pending', organizerId: 'other-user' }));
        const forbiddenNext = jest.fn();
        await runRouteHandlers(updateHandlers, createRequest({ user: { id: 'user-1' }, params: { id: 'event-1' }, body: { title: 'Novo', description: 'Resumo', date: '2026-06-10T19:00:00.000Z' } }), createResponseDouble(), forbiddenNext);
        expect(forbiddenNext.mock.calls[0][0].status).toBe(403);

        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'published', organizerId: 'user-1' }));
        const publishedNext = jest.fn();
        await runRouteHandlers(updateHandlers, createRequest({ user: { id: 'user-1' }, params: { id: 'event-1' }, body: { title: 'Novo', description: 'Resumo', date: '2026-06-10T19:00:00.000Z' } }), createResponseDouble(), publishedNext);
        expect(publishedNext.mock.calls[0][0].status).toBe(403);

        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'rejected', organizerId: 'user-1' }));
        trackReplacement(restores, Event, 'updateDetails', async () => {
            throw new Error('write failed');
        });
        const errorNext = jest.fn();
        await runRouteHandlers(updateHandlers, createRequest({ user: { id: 'user-1' }, params: { id: 'event-1' }, body: { title: 'Novo', description: 'Resumo', date: '2026-06-10T19:00:00.000Z' } }), createResponseDouble(), errorNext);
        expect(errorNext.mock.calls[0][0].status).toBe(500);
    });

    test('delete enforces ownership and manageable statuses and wraps failures', async () => {
        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'pending', organizerId: 'user-1' }));
        const removeCalls = [];
        trackReplacement(restores, Event, 'remove', async id => {
            removeCalls.push(id);
        });

        const successRes = createResponseDouble();
        const successNext = jest.fn();
        await runRouteHandlers(deleteHandlers, createRequest({ user: { id: 'user-1' }, params: { id: 'event-1' } }), successRes, successNext);
        expect(successNext).not.toHaveBeenCalled();
        expect(removeCalls).toEqual(['event-1']);

        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'pending', organizerId: 'other-user' }));
        const forbiddenNext = jest.fn();
        await runRouteHandlers(deleteHandlers, createRequest({ user: { id: 'user-1' }, params: { id: 'event-1' } }), createResponseDouble(), forbiddenNext);
        expect(forbiddenNext.mock.calls[0][0].status).toBe(403);

        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'rejected', organizerId: 'user-1' }));
        trackReplacement(restores, Event, 'remove', async () => {
            throw new Error('delete failed');
        });
        const errorNext = jest.fn();
        await runRouteHandlers(deleteHandlers, createRequest({ user: { id: 'user-1' }, params: { id: 'event-1' } }), createResponseDouble(), errorNext);
        expect(errorNext.mock.calls[0][0].status).toBe(500);
    });

    test('moderation decisions enforce admin rules, validate statuses, and wrap failures', async () => {
        const statusCalls = [];
        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'pending', organizerId: 'user-2' }));
        trackReplacement(restores, Event, 'updateStatus', async (id, status, options) => {
            statusCalls.push({ id, status, options });
            return buildEvent({ id, status, organizerId: 'user-2', rejectionReason: options?.rejectionReason ?? null });
        });

        const publishRes = createResponseDouble();
        const publishNext = jest.fn();
        await runRouteHandlers(moderationDecisionHandlers, createRequest({ user: { id: 'admin-1', role: 'admin' }, params: { id: 'event-1' }, body: { status: 'published' } }), publishRes, publishNext);
        expect(publishNext).not.toHaveBeenCalled();
        expect(statusCalls).toEqual([{ id: 'event-1', status: 'published', options: { rejectionReason: null } }]);
        expect(publishRes.body.message).toBe('Evento aprovado e publicado.');

        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'pending', organizerId: 'user-2' }));
        trackReplacement(restores, Event, 'updateStatus', async (id, status, options) => {
            statusCalls.push({ id, status, options });
            return buildEvent({ id, status, organizerId: 'user-2', rejectionReason: options?.rejectionReason ?? null });
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
            options: { rejectionReason: 'Ajuste a descrição do público-alvo.' },
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

        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'pending', organizerId: 'user-2' }));
        const invalidStatusNext = jest.fn();
        await runRouteHandlers(moderationDecisionHandlers, createRequest({ user: { id: 'admin-1', role: 'admin' }, params: { id: 'event-1' }, body: { status: 'pending' } }), createResponseDouble(), invalidStatusNext);
        expect(invalidStatusNext.mock.calls[0][0].status).toBe(400);

        const nonAdminNext = jest.fn();
        await runRouteHandlers(moderationDecisionHandlers, createRequest({ user: { id: 'user-1', role: 'member' }, params: { id: 'event-1' }, body: { status: 'published' } }), createResponseDouble(), nonAdminNext);
        expect(nonAdminNext.mock.calls[0][0].status).toBe(403);

        trackReplacement(restores, Event, 'findById', async id => buildEvent({ id, status: 'pending', organizerId: 'user-2' }));
        trackReplacement(restores, Event, 'updateStatus', async () => {
            throw new Error('write failed');
        });
        const errorNext = jest.fn();
        await runRouteHandlers(moderationDecisionHandlers, createRequest({ user: { id: 'admin-1', role: 'admin' }, params: { id: 'event-1' }, body: { status: 'rejected' } }), createResponseDouble(), errorNext);
        expect(errorNext.mock.calls[0][0].status).toBe(500);
    });
});