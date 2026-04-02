import { afterEach, describe, expect, test } from '@jest/globals';
import { Event } from '../../model/event.js';
import { buildEvent } from './support/fixtures.js';
import { restoreTracked, trackReplacement } from './support/doubles.js';

const restores = [];

afterEach(() => {
    restoreTracked(restores);
});

describe('model/event', () => {
    test('ensureSchema adds the moderation column and backfills existing rows once', async () => {
        const calls = [];
        trackReplacement(restores, Event, 'driver', {
            async query(sql, data) {
                calls.push({ sql, data });

                if (sql.includes("SHOW COLUMNS")) {
                    return [];
                }

                return { ok: true };
            },
        });

        await Event.ensureSchema();

        expect(calls).toHaveLength(3);
        expect(calls[0].sql).toMatch(/SHOW COLUMNS FROM `events` LIKE 'status'/);
        expect(calls[1].sql).toMatch(/ALTER TABLE `events` ADD COLUMN `status` VARCHAR\(32\) NOT NULL DEFAULT 'pending'/);
        expect(calls[2]).toEqual({
            sql: 'UPDATE `events` SET `status` = ?',
            data: ['published'],
        });
    });

    test('ensureSchema returns early when the status column already exists', async () => {
        const calls = [];
        const { Event: FreshEvent } = await import(`../../model/event.js?case=${Date.now()}-${Math.random()}`);

        FreshEvent.driver = {
            async query(sql) {
                calls.push(sql);
                return [{ Field: 'status' }];
            },
        };

        await FreshEvent.ensureSchema();

        expect(calls).toEqual(["SHOW COLUMNS FROM `events` LIKE 'status'"]);
    });

    test('constructor applies defaults and status normalization helpers', () => {
        const event = new Event({
            title: 'Workshop',
            description: 'Hands-on session',
            date: '2026-05-20T18:00:00.000Z',
            status: 'INVALID',
        });

        expect(event.category).toBe('Geral');
        expect(event.location).toBe('A definir');
        expect(event.status).toBe('pending');
        expect(Event.isPublishedStatus('published')).toBe(true);
        expect(Event.canOwnerManageStatus('rejected')).toBe(true);
        expect(Event.canOwnerManageStatus('published')).toBe(false);
    });

    test('normalizeStatus trims unknown values back to pending', () => {
        expect(Event.normalizeStatus('  rejected  ')).toBe('rejected');
        expect(Event.normalizeStatus('archived')).toBe('pending');
        expect(Event.isPublishedStatus(' published ')).toBe(true);
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
            organizer_id: 'user-1',
            created_at: '2026-04-02T12:00:00.000Z',
        });
        const serialized = Event.serialize(buildEvent({ status: 'PUBLISHED', organizerId: 'user-1' }));

        expect(normalized).toEqual({
            id: 'event-1',
            title: 'Semana',
            description: 'Palestras',
            date: '2026-05-20T18:00:00.000Z',
            category: 'Tecnologia',
            location: 'Auditorio',
            status: 'published',
            organizerId: 'user-1',
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
            location: 'Auditorio',
            status: 'pending',
            organizerId: 'user-1',
            createdAt: undefined,
        });
    });

    test('serializeEditablePayload omits undefined fields and normalizes status', () => {
        trackReplacement(restores, Event, 'driver', {
            toDateTime(value) {
                return `mysql:${value}`;
            },
        });

        const serialized = Event.serializeEditablePayload({
            title: 'Novo titulo',
            date: '2026-06-01T10:00:00.000Z',
            status: 'REJECTED',
        });

        expect(serialized).toEqual({
            title: 'Novo titulo',
            date: 'mysql:2026-06-01T10:00:00.000Z',
            status: 'rejected',
        });
    });

    test('list applies public status and in-memory search filters', async () => {
        const findCalls = [];
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
                buildEvent({ title: 'Semana da Computacao', category: 'Tecnologia', location: 'Auditorio' }),
                buildEvent({ id: 'event-2', title: 'Feira de Artes', category: 'Cultura', location: 'Patio' }),
            ];
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
        trackReplacement(restores, Event, 'find', async options => {
            calls.push(options);
            return [buildEvent({ id: 'event-1' })];
        });

        await expect(Event.list({ from: '2026-05-01T00:00:00.000Z' })).resolves.toEqual([buildEvent({ id: 'event-1' })]);
        await expect(Event.list({ to: '2026-05-31T23:59:59.000Z' })).resolves.toEqual([buildEvent({ id: 'event-1' })]);

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
    });

    test('listByOrganizer and listForModeration delegate with the right filters', async () => {
        const calls = [];
        trackReplacement(restores, Event, 'find', async options => {
            calls.push(options);
            return [];
        });

        await Event.listByOrganizer('user-1');
        await Event.listForModeration({ moderatorId: 'admin-1', status: 'REJECTED' });

        expect(calls).toEqual([
            {
                filter: { organizer_id: 'user-1' },
                opt: { order: { date: 0 } },
            },
            {
                filter: {
                    status: 'rejected',
                    organizer_id: { not: 'admin-1' },
                },
                opt: { order: { date: 0 } },
            },
        ]);
    });

    test('listByOrganizer and find helpers short-circuit missing ids, and moderation defaults to unpublished events', async () => {
        const calls = [];
        trackReplacement(restores, Event, 'find', async options => {
            calls.push(options);
            return [];
        });

        await expect(Event.listByOrganizer('')).resolves.toEqual([]);
        await expect(Event.findById('')).resolves.toBeNull();
        await expect(Event.findPublicById('')).resolves.toBeNull();
        await Event.listForModeration();

        expect(calls).toEqual([{
            filter: { status: { not: 'published' } },
            opt: { order: { date: 0 } },
        }]);
    });

    test('create inserts the event and reloads it', async () => {
        const insertCalls = [];
        const getCalls = [];
        trackReplacement(restores, Event, 'ensureSchema', async () => {});
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
        trackReplacement(restores, Event, 'ensureSchema', async () => {});
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
        const updatedStatus = await Event.updateStatus('event-1', 'published');
        await Event.remove('event-1');

        expect(updateCalls).toEqual([
            {
                table: 'events',
                payload: { title: 'Novo titulo' },
                id: 'event-1',
            },
            {
                table: 'events',
                payload: { status: 'published' },
                id: 'event-1',
            },
        ]);
        expect(updatedDetails.id).toBe('event-1');
        expect(updatedStatus.id).toBe('event-1');
        expect(deleteCalls).toEqual([{ table: 'events', id: 'event-1', opt: { limit: 1 } }]);
    });

    test('updateDetails, updateStatus, and remove short-circuit missing ids', async () => {
        const calls = [];
        trackReplacement(restores, Event, 'ensureSchema', async () => {
            calls.push('ensureSchema');
        });

        await expect(Event.updateDetails('', { title: 'Ignored' })).resolves.toBeNull();
        await expect(Event.updateStatus('', 'published')).resolves.toBeNull();
        await expect(Event.remove('')).resolves.toBeUndefined();
        expect(calls).toEqual([]);
    });
});