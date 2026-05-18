import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { Event } from '../../model/event.js';
import { Relation } from '../../model/relation.js';
import { buildEvent } from './support/fixtures.js';
import { restoreTracked, trackReplacement } from './support/doubles.js';

const restores = [];

afterEach(() => {
    restoreTracked(restores);
});

describe('model/event', () => {
    test('constructor applies defaults and moderation normalization helpers', () => {
        const event = new Event({
            title: 'Workshop',
            description: 'Hands-on session',
            date: '2026-05-20T18:00:00.000Z',
            status: 'INVALID',
            rejectionReason: '   ',
        });

        expect(event.category).toBe('outro');
        expect(event.location).toBe('A definir');
        expect(event.status).toBe('pending');
        expect(event.rejectionReason).toBeNull();
        expect(Event.isPublishedStatus('published')).toBe(true);
        expect(Event.isPendingLikeStatus('pending')).toBe(true);
        expect(Event.canOwnerEditStatus('published')).toBe(false);
        expect(Event.canOwnerEditStatus('pending')).toBe(true);
        expect(Event.canOwnerDeleteStatus('published')).toBe(false);
        expect(Event.canOwnerDeleteStatus('pending')).toBe(true);
        expect(Event.canOwnerManageStatus('rejected')).toBe(true);
        expect(Event.canOwnerManageStatus('published')).toBe(false);
    });

    test('normalizeStatus and normalizeRejectionReason trim moderation values', () => {
        expect(Event.normalizeStatus('  rejected  ')).toBe('rejected');
        expect(Event.normalizeStatus('  pending  ')).toBe('pending');
        expect(Event.normalizeStatus('archived')).toBe('pending');
        expect(Event.isPublishedStatus(' published ')).toBe(true);
        expect(Event.isPendingLikeStatus(' pending ')).toBe(true);
        expect(Event.normalizeRejectionReason('  Ajuste a data do evento.  ')).toBe('Ajuste a data do evento.');
        expect(Event.normalizeRejectionReason('   ')).toBeNull();
        expect(Event.normalizeCalendarLink('  https://calendar.google.com/event  ')).toBe('https://calendar.google.com/event');
        expect(Event.normalizeCalendarLink('   ')).toBeNull();
        expect(Event.normalizeCalendarEventId('  calendar-event-1  ')).toBe('calendar-event-1');
        expect(Event.normalizeCalendarEventId('   ')).toBeNull();
    });

    test('normalize and serialize map database fields consistently', () => {
        trackReplacement(restores, Event, 'driver', {
            toDateTime(value) {
                return `mysql:${value}`;
            },
        });

        const normalized = Event.normalize({
            id: 'event-1',
            title: 'Semana',
            description: 'Palestras',
            date: '2026-05-20T18:00:00.000Z',
            category: 'Tecnologia',
            location: 'Auditorio',
            status: 'PUBLISHED',
            rejectionReason: 'Aprovado sem pendencias.',
            calendar_link: ' https://calendar.google.com/calendar/event?eid=abc123 ',
            calendar_event_id: ' calendar-event-1 ',
            organizer_id: 'user-1',
            organizer_name: '  Ada Lovelace  ',
            created_at: '2026-04-02T12:00:00.000Z',
        });
        const serialized = Event.serialize(buildEvent({
            status: 'PUBLISHED',
            organizerId: 'user-1',
            category: 'Tecnologia',
            rejectionReason: '  Falta anexar o cronograma.  ',
            calendarLink: ' https://calendar.google.com/calendar/event?eid=fixture ',
            calendarEventId: ' calendar-event-fixture ',
        }));

        expect(normalized).toEqual({
            id: 'event-1',
            title: 'Semana',
            description: 'Palestras',
            date: '2026-05-20T18:00:00.000Z',
            category: 'Tecnologia',
            categoryLabel: 'Tecnologia',
            location: 'Auditorio',
            status: 'published',
            rejectionReason: 'Aprovado sem pendencias.',
            calendarLink: 'https://calendar.google.com/calendar/event?eid=abc123',
            calendarEventId: 'calendar-event-1',
            organizerId: 'user-1',
            organizerName: 'Ada Lovelace',
            createdAt: '2026-04-02T12:00:00.000Z',
        });
        expect(serialized).toEqual({
            id: 'event-1',
            title: 'Semana da Computacao',
            description: 'Palestras e oficinas para a comunidade academica.',
            date: 'mysql:2026-05-20T18:00:00.000Z',
            category: 'Tecnologia',
            location: 'Auditorio Central',
            status: 'published',
            rejection_reason: 'Falta anexar o cronograma.',
            calendar_link: 'https://calendar.google.com/calendar/event?eid=fixture',
            calendar_event_id: 'calendar-event-fixture',
            organizer_id: 'user-1',
            created_at: 'mysql:2026-04-02T12:00:00.000Z',
        });
    });

    test('normalize returns null for missing rows and preserves blank dates', () => {
        expect(Event.normalize(null)).toBeNull();
        expect(Event.normalize({
            id: 'event-1',
            title: 'Semana',
            description: 'Palestras',
            date: null,
            category: 'Tecnologia',
            location: 'Auditorio',
            status: 'pending',
            organizer_id: 'user-1',
        })).toEqual({
            id: 'event-1',
            title: 'Semana',
            description: 'Palestras',
            date: null,
            category: 'Tecnologia',
            categoryLabel: 'Tecnologia',
            location: 'Auditorio',
            status: 'pending',
            rejectionReason: null,
            calendarLink: null,
            calendarEventId: null,
            organizerId: 'user-1',
            organizerName: undefined,
            createdAt: undefined,
        });
    });

    test('serializeEditablePayload omits undefined fields and normalizes moderation metadata', () => {
        trackReplacement(restores, Event, 'driver', {
            toDateTime(value) {
                return `mysql:${value}`;
            },
        });

        const serialized = Event.serializeEditablePayload({
            title: 'Novo titulo',
            date: '2026-06-01T10:00:00.000Z',
            status: 'REJECTED',
            rejectionReason: '  Ajustar local e público-alvo. ',
            calendarLink: ' https://calendar.google.com/calendar/event?eid=editable ',
            calendarEventId: ' calendar-event-editable ',
        });

        expect(serialized).toEqual({
            title: 'Novo titulo',
            date: 'mysql:2026-06-01T10:00:00.000Z',
            status: 'rejected',
            rejection_reason: 'Ajustar local e público-alvo.',
            calendar_link: 'https://calendar.google.com/calendar/event?eid=editable',
            calendar_event_id: 'calendar-event-editable',
        });
    });

    test('list applies public status and in-memory search filters', async () => {
        const findCalls = [];
        const relationCalls = [];
        trackReplacement(restores, Event, 'driver', {
            toDateTime(value) {
                return `mysql:${value}`;
            },
            between(start, end) {
                return { between: [start, end] };
            },
            gte(value) {
                return { '>=': value };
            },
            lte(value) {
                return { '<=': value };
            },
        });
        trackReplacement(restores, Event, 'find', async options => {
            findCalls.push(options);
            return [
                buildEvent({ title: 'Semana da Computacao', category: 'Tecnologia', location: 'Auditorio', organizerName: undefined }),
                buildEvent({ id: 'event-2', title: 'Feira de Artes', category: 'Cultura', location: 'Patio', organizerId: 'user-2', organizerName: undefined }),
            ];
        });
        trackReplacement(restores, Relation.prototype, 'getMany', async function(fieldValues, options) {
            relationCalls.push({ fieldValues, options });
            return [{ id: 'user-1', name: 'Ada Lovelace' }];
        });

        const events = await Event.list({
            search: 'comp',
            category: 'tecnologia',
            from: '2026-05-01T00:00:00.000Z',
            to: '2026-05-30T23:59:59.000Z',
        });

        expect(findCalls[0]).toEqual({
            filter: {
                status: 'published',
                date: { between: ['mysql:2026-05-01T00:00:00.000Z', 'mysql:2026-05-30T23:59:59.000Z'] },
            },
            opt: { order: { date: 1 } },
        });
        expect(events.map(event => event.id)).toEqual(['event-1']);
        expect(events[0].organizerName).toBe('Ada Lovelace');
        expect(relationCalls).toEqual([{
            fieldValues: ['user-1'],
            options: { view: ['id', 'name'] },
        }]);
    });

    test('list supports open-ended date filters and returns all events when no search is present', async () => {
        const driver = {
            toDateTime(value) {
                return `mysql:${value}`;
            },
            gte(value) {
                return { '>=': value };
            },
            lte(value) {
                return { '<=': value };
            },
        };
        trackReplacement(restores, Event, 'driver', driver);

        const calls = [];
        const relationCalls = [];
        trackReplacement(restores, Event, 'find', async options => {
            calls.push(options);
            return [buildEvent({ id: 'event-1', organizerName: undefined })];
        });
        trackReplacement(restores, Relation.prototype, 'getMany', async function(fieldValues, options) {
            relationCalls.push({ fieldValues, options });
            return [{ id: 'user-1', name: 'Ada Lovelace' }];
        });

        await expect(Event.list({ from: '2026-05-01T00:00:00.000Z' })).resolves.toEqual([buildEvent({ id: 'event-1', organizerName: 'Ada Lovelace' })]);
        await expect(Event.list({ to: '2026-05-31T23:59:59.000Z' })).resolves.toEqual([buildEvent({ id: 'event-1', organizerName: 'Ada Lovelace' })]);

        expect(calls).toEqual([
            {
                filter: { status: 'published', date: { '>=': 'mysql:2026-05-01T00:00:00.000Z' } },
                opt: { order: { date: 1 } },
            },
            {
                filter: { status: 'published', date: { '<=': 'mysql:2026-05-31T23:59:59.000Z' } },
                opt: { order: { date: 1 } },
            },
        ]);
        expect(relationCalls).toEqual([
            { fieldValues: ['user-1'], options: { view: ['id', 'name'] } },
            { fieldValues: ['user-1'], options: { view: ['id', 'name'] } },
        ]);
    });

    test('list expands a date-only end filter to the end of the selected day', async () => {
        const driver = {
            toDateTime(value) {
                return `mysql:${value}`;
            },
            lte(value) {
                return { '<=': value };
            },
        };
        trackReplacement(restores, Event, 'driver', driver);

        const calls = [];
        trackReplacement(restores, Event, 'find', async options => {
            calls.push(options);
            return [];
        });

        await expect(Event.list({ to: '2026-05-31' })).resolves.toEqual([]);

        expect(calls).toEqual([
            {
                filter: { status: 'published', date: { '<=': 'mysql:2026-05-31T23:59:59.999Z' } },
                opt: { order: { date: 1 } },
            },
        ]);
    });

    test('listCurrentWeek delegates to the public Sunday-to-Saturday week range', async () => {
        const listSpy = jest.spyOn(Event, 'list').mockResolvedValue([]);
        const referenceDate = new Date(2026, 3, 7, 18, 0, 0, 0);

        await expect(Event.listCurrentWeek(referenceDate)).resolves.toEqual([]);

        expect(listSpy).toHaveBeenCalledWith({
            from: '2026-04-05',
            to: '2026-04-11',
        });
    });

    test('listByOrganizer delegates with the right filters', async () => {
        const calls = [];
        trackReplacement(restores, Event, 'find', async options => {
            calls.push(options);
            return [];
        });

        await Event.listByOrganizer('user-1');

        expect(calls).toEqual([
            {
                filter: { organizer_id: 'user-1' },
                opt: { order: { date: 0 } },
            },
        ]);
    });

    test('listForModeration queries unpublished events together with organizer names', async () => {
        const calls = [];
        const relationCalls = [];
        trackReplacement(restores, Event, 'find', async options => {
            calls.push(options);
            return [buildEvent({
                organizerId: 'user-2',
                organizerName: undefined,
                status: 'rejected',
                rejectionReason: 'Ajustar cronograma',
                category: 'Tecnologia',
                location: 'Auditorio',
                title: 'Semana',
                description: 'Palestras',
            })];
        });
        trackReplacement(restores, Relation.prototype, 'getMany', async function(fieldValues, options) {
            relationCalls.push({ fieldValues, options });
            return [{ id: 'user-2', name: 'Grace Hopper' }];
        });

        await expect(Event.listForModeration({ moderatorId: 'admin-1', status: 'REJECTED' })).resolves.toEqual([
            buildEvent({
                organizerId: 'user-2',
                organizerName: 'Grace Hopper',
                status: 'rejected',
                rejectionReason: 'Ajustar cronograma',
                category: 'Tecnologia',
                location: 'Auditorio',
                title: 'Semana',
                description: 'Palestras',
            }),
        ]);

        expect(calls).toEqual([{
            filter: {
                status: 'rejected',
                organizer_id: { not: 'admin-1' },
            },
            opt: { order: { date: 0 } },
        }]);
        expect(relationCalls).toEqual([{
            fieldValues: ['user-2'],
            options: { view: ['id', 'name'] },
        }]);
    });

    test('listForModeration treats pending filters as pending-like queue statuses', async () => {
        const calls = [];
        trackReplacement(restores, Event, 'find', async options => {
            calls.push(options);
            return [];
        });
        trackReplacement(restores, Relation.prototype, 'getMany', async function() {
            return [];
        });

        await Event.listForModeration({ status: 'pending' });

        expect(calls).toEqual([{
            filter: {
                status: 'pending',
            },
            opt: { order: { date: 0 } },
        }]);
    });

    test('listByOrganizer and find helpers short-circuit missing ids, and moderation defaults to unpublished events', async () => {
        const calls = [];
        const relationCalls = [];
        trackReplacement(restores, Event, 'find', async options => {
            calls.push(options);
            return [];
        });
        trackReplacement(restores, Relation.prototype, 'getMany', async function(fieldValues, options) {
            relationCalls.push({ fieldValues, options });
            return [];
        });

        await expect(Event.listByOrganizer('')).resolves.toEqual([]);
        await expect(Event.findById('')).resolves.toBeNull();
        await expect(Event.findPublicById('')).resolves.toBeNull();
        await Event.listForModeration();

        expect(calls).toEqual([{
            filter: {
                status: { not: 'published' },
            },
            opt: { order: { date: 0 } },
        }]);
        expect(relationCalls).toEqual([]);
    });

    test('create inserts the event and reloads it', async () => {
        const insertCalls = [];
        const getCalls = [];
        trackReplacement(restores, Event, 'insert', async payload => {
            insertCalls.push(payload);
            return { id: 'event-1' };
        });
        trackReplacement(restores, Event, 'get', async id => {
            getCalls.push(id);
            return buildEvent({ id });
        });

        const created = await Event.create(buildEvent());

        expect(insertCalls).toHaveLength(1);
        expect(getCalls).toEqual(['event-1']);
        expect(created.id).toBe('event-1');
    });

    test('updateDetails, updateStatus, and remove delegate through the driver', async () => {
        const updateCalls = [];
        const deleteCalls = [];
        trackReplacement(restores, Event, 'serializeEditablePayload', payload => payload);
        trackReplacement(restores, Event, 'driver', {
            async update(table, payload, id) {
                updateCalls.push({ table, payload, id });
            },
            async delete(table, id, opt) {
                deleteCalls.push({ table, id, opt });
            },
        });
        trackReplacement(restores, Event, 'get', async id => buildEvent({ id }));

        const updatedDetails = await Event.updateDetails('event-1', { title: 'Novo titulo' });
        const updatedStatus = await Event.updateStatus('event-1', 'published', {
            rejectionReason: 'Nao deve permanecer salvo.',
            calendarLink: null,
            calendarEventId: 'calendar-event-1',
        });
        await Event.remove('event-1');

        expect(updateCalls).toEqual([
            {
                table: 'events',
                payload: { title: 'Novo titulo' },
                id: 'event-1',
            },
            {
                table: 'events',
                payload: {
                    status: 'published',
                    rejection_reason: 'Nao deve permanecer salvo.',
                    calendar_link: null,
                    calendar_event_id: 'calendar-event-1',
                },
                id: 'event-1',
            },
        ]);
        expect(updatedDetails.id).toBe('event-1');
        expect(updatedStatus.id).toBe('event-1');
        expect(deleteCalls).toEqual([{ table: 'events', id: 'event-1', opt: { limit: 1 } }]);
    });

    test('updateDetails, updateStatus, and remove short-circuit missing ids', async () => {
        await expect(Event.updateDetails('', { title: 'Ignored' })).resolves.toBeNull();
        await expect(Event.updateStatus('', 'published')).resolves.toBeNull();
        await expect(Event.remove('')).resolves.toBeUndefined();
    });
});