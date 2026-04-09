import { afterEach, describe, expect, test } from '@jest/globals';
import { User } from '../../model/user.js';
import { buildUser } from './support/fixtures.js';
import { restoreTracked, trackReplacement } from './support/doubles.js';

const restores = [];

afterEach(() => {
    restoreTracked(restores);
});

describe('model/user', () => {
    test('constructor normalizes email, role, and password hashing', () => {
        const user = new User({
            name: '  Ada  ',
            email: ' ADA@EXAMPLE.COM ',
            role: 'OWNER',
            password: 'secret123',
            emailPreferences: {
                eventUpdates: 0,
                adminPendingRequests: 'false',
            },
        });

        expect(user.name).toBe('Ada');
        expect(user.email).toBe('ada@example.com');
        expect(user.role).toBe('member');
        expect(user.emailPreferences).toEqual({
            eventUpdates: false,
            adminPendingRequests: false,
        });
        expect(user.passwordHash).not.toBe('secret123');
        expect(user.validatePassword('secret123')).toBe(true);
        expect(user.validatePassword('other')).toBe(false);
    });

    test('normalize maps database rows to the public entity shape', () => {
        const user = User.normalize({
            id: 'user-1',
            name: 'Ada',
            email: 'ada@example.com',
            role: 'ADMIN',
            password_hash: 'hashed',
            email_event_updates_enabled: 1,
            email_admin_pending_requests_enabled: 0,
            created_at: '2026-04-02T12:00:00.000Z',
        });

        expect(user).toEqual({
            id: 'user-1',
            name: 'Ada',
            email: 'ada@example.com',
            role: 'admin',
            emailPreferences: {
                eventUpdates: true,
                adminPendingRequests: false,
            },
            passwordHash: 'hashed',
            createdAt: '2026-04-02T12:00:00.000Z',
        });
    });

    test('normalize returns null for missing rows and preserves missing createdAt', () => {
        expect(User.normalize(null)).toBeNull();
        expect(User.normalize({
            id: 'user-1',
            name: 'Ada',
            email: 'ada@example.com',
            role: 'member',
            password_hash: 'hashed',
        })).toEqual({
            id: 'user-1',
            name: 'Ada',
            email: 'ada@example.com',
            role: 'member',
            passwordHash: 'hashed',
            createdAt: undefined,
            emailPreferences: {
                eventUpdates: true,
                adminPendingRequests: true,
            },
        });
    });

    test('serialize normalizes fields and uses the active driver date formatter', () => {
        trackReplacement(restores, User, 'driver', {
            toDateTime(value) {
                return `mysql:${value}`;
            },
        });

        const serialized = User.serialize({
            id: 'user-1',
            name: 'Ada',
            email: 'ADA@EXAMPLE.COM',
            role: 'ADMIN',
            passwordHash: 'hashed',
            emailPreferences: {
                eventUpdates: true,
                adminPendingRequests: false,
            },
            createdAt: '2026-04-02T12:00:00.000Z',
        });

        expect(serialized).toEqual({
            id: 'user-1',
            name: 'Ada',
            email: 'ada@example.com',
            role: 'admin',
            password_hash: 'hashed',
            email_event_updates_enabled: true,
            email_admin_pending_requests_enabled: false,
            created_at: 'mysql:2026-04-02T12:00:00.000Z',
        });
    });

    test('serialize accepts hydrated users and pre-hashed payloads', () => {
        trackReplacement(restores, User, 'driver', {
            toDateTime(value) {
                return `mysql:${value}`;
            },
        });

        const hydrated = new User({
            id: 'user-2',
            name: 'Grace',
            email: 'GRACE@EXAMPLE.COM',
            role: 'admin',
            passwordHash: 'ready-hash',
        });

        expect(User.serialize(hydrated)).toEqual({
            id: 'user-2',
            name: 'Grace',
            email: 'grace@example.com',
            role: 'admin',
            password_hash: 'ready-hash',
            email_event_updates_enabled: true,
            email_admin_pending_requests_enabled: true,
            created_at: expect.stringMatching(/^mysql:/),
        });

        expect(User.serialize({
            id: 'user-3',
            name: 'Linus',
            email: 'linus@example.com',
            role: 'owner',
            passwordHash: 'stored-hash',
            emailPreferences: {
                eventUpdates: false,
                adminPendingRequests: true,
            },
        })).toEqual({
            id: 'user-3',
            name: 'Linus',
            email: 'linus@example.com',
            role: 'member',
            password_hash: 'stored-hash',
            email_event_updates_enabled: false,
            email_admin_pending_requests_enabled: true,
            created_at: expect.stringMatching(/^mysql:/),
        });
    });

    test('list builds filters for role and excluded ids', async () => {
        let receivedOptions;
        trackReplacement(restores, User, 'find', async options => {
            receivedOptions = options;
            return [buildUser({ id: 'user-2' })];
        });

        const users = await User.list({ role: 'ADMIN', excludeId: 'user-1' });

        expect(receivedOptions).toEqual({
            filter: {
                role: 'admin',
                id: { not: 'user-1' },
            },
            view: User.SAFE_VIEW,
            opt: { order: { name: 1 } },
        });
        expect(users[0].id).toBe('user-2');
    });

    test('findByEmail normalizes the email before lookup', async () => {
        const calls = [];
        trackReplacement(restores, User, 'get', async clause => {
            calls.push(clause);
            return buildUser();
        });

        await User.findByEmail('ADA@EXAMPLE.COM');

        expect(calls).toEqual([{ email: 'ada@example.com' }]);
    });

    test('findByEmail and findById short-circuit when the identifier is missing', async () => {
        const getSpy = [];
        trackReplacement(restores, User, 'get', async clause => {
            getSpy.push(clause);
            return buildUser();
        });

        await expect(User.findByEmail('')).resolves.toBeNull();
        await expect(User.findById('')).resolves.toBeNull();
        expect(getSpy).toEqual([]);
    });

    test('updateProfile normalizes persisted fields and reloads the entity', async () => {
        const updateCalls = [];
        trackReplacement(restores, User, 'driver', {
            async update(table, payload, id) {
                updateCalls.push({ table, payload, id });
            },
        });
        trackReplacement(restores, User, 'get', async id => buildUser({ id, name: 'Grace Hopper', email: 'grace@example.com' }));

        const updated = await User.updateProfile('user-1', {
            name: '  Grace Hopper  ',
            email: ' GRACE@EXAMPLE.COM ',
        });

        expect(updateCalls).toEqual([{
            table: 'users',
            payload: {
                name: 'Grace Hopper',
                email: 'grace@example.com',
            },
            id: 'user-1',
        }]);
        expect(updated).toEqual(buildUser({ id: 'user-1', name: 'Grace Hopper', email: 'grace@example.com' }));
    });

    test('listForAdministration delegates to list with the excluded actor id', async () => {
        const calls = [];
        trackReplacement(restores, User, 'list', async options => {
            calls.push(options);
            return [];
        });

        await User.listForAdministration({ excludeId: 'admin-1' });

        expect(calls).toEqual([{ excludeId: 'admin-1' }]);
    });

    test('create inserts and reloads the stored account', async () => {
        const insertCalls = [];
        const getCalls = [];
        trackReplacement(restores, User, 'insert', async payload => {
            insertCalls.push(payload);
            return { id: 'user-1' };
        });
        trackReplacement(restores, User, 'get', async id => {
            getCalls.push(id);
            return buildUser({ id });
        });

        const created = await User.create({ name: 'Ada' });

        expect(insertCalls).toEqual([{ name: 'Ada' }]);
        expect(getCalls).toEqual(['user-1']);
        expect(created.id).toBe('user-1');
    });

    test('updatePassword hashes the password and reloads the entity', async () => {
        const updateCalls = [];
        trackReplacement(restores, User, 'driver', {
            async update(table, payload, id) {
                updateCalls.push({ table, payload, id });
            },
        });
        trackReplacement(restores, User, 'get', async id => buildUser({ id }));

        const updated = await User.updatePassword('user-1', 'new-secret');

        expect(updateCalls[0].table).toBe('users');
        expect(updateCalls[0].id).toBe('user-1');
        expect(typeof updateCalls[0].payload.password_hash).toBe('string');
        expect(updateCalls[0].payload.password_hash).not.toBe('new-secret');
        expect(updated.id).toBe('user-1');
    });

    test('updatePassword, updateProfile, updateEmailPreferences, and updateRole short-circuit when the user id is missing', async () => {
        const driverCalls = [];
        trackReplacement(restores, User, 'driver', {
            async update(...args) {
                driverCalls.push(args);
            },
        });

        await expect(User.updatePassword('', 'new-secret')).resolves.toBeNull();
        await expect(User.updateProfile('', { name: 'Ada', email: 'ada@example.com' })).resolves.toBeNull();
        await expect(User.updateEmailPreferences('', { eventUpdates: true, adminPendingRequests: true })).resolves.toBeNull();
        await expect(User.updateRole('', 'admin')).resolves.toBeNull();
        expect(driverCalls).toEqual([]);
    });

    test('allowsEmailPreference normalizes supported preference snapshots', () => {
        expect(User.allowsEmailPreference(buildUser({
            emailPreferences: {
                eventUpdates: false,
                adminPendingRequests: true,
            },
        }), User.EMAIL_PREFERENCE_KEYS.eventUpdates)).toBe(false);
    });

    test('listEmailPreferenceRecipients builds the preference filter and optional role constraints', async () => {
        let receivedOptions;
        trackReplacement(restores, User, 'find', async options => {
            receivedOptions = options;
            return [];
        });

        await User.listEmailPreferenceRecipients(User.EMAIL_PREFERENCE_KEYS.adminPendingRequests, {
            role: 'ADMIN',
            excludeId: 'admin-1',
        });

        expect(receivedOptions).toEqual({
            filter: {
                email_admin_pending_requests_enabled: true,
                role: 'admin',
                id: { not: 'admin-1' },
            },
            view: User.SAFE_VIEW,
            opt: { order: { name: 1 } },
        });
    });

    test('updateEmailPreferences persists the normalized preference flags and reloads the entity', async () => {
        const updateCalls = [];
        trackReplacement(restores, User, 'driver', {
            async update(table, payload, id) {
                updateCalls.push({ table, payload, id });
            },
        });
        trackReplacement(restores, User, 'get', async id => buildUser({
            id,
            emailPreferences: {
                eventUpdates: true,
                adminPendingRequests: false,
            },
        }));

        const updated = await User.updateEmailPreferences('user-1', {
            eventUpdates: true,
            adminPendingRequests: false,
        });

        expect(updateCalls).toEqual([{
            table: 'users',
            payload: {
                email_event_updates_enabled: true,
                email_admin_pending_requests_enabled: false,
            },
            id: 'user-1',
        }]);
        expect(updated.emailPreferences).toEqual({
            eventUpdates: true,
            adminPendingRequests: false,
        });
    });

    test('updateRole normalizes the stored role before persisting', async () => {
        const updateCalls = [];
        trackReplacement(restores, User, 'driver', {
            async update(table, payload, id) {
                updateCalls.push({ table, payload, id });
            },
        });
        trackReplacement(restores, User, 'get', async id => buildUser({ id, role: 'member' }));

        await User.updateRole('user-1', 'OWNER');

        expect(updateCalls).toEqual([{
            table: 'users',
            payload: { role: 'member' },
            id: 'user-1',
        }]);
    });

    test('promoteToAdmin delegates to updateRole', async () => {
        const calls = [];
        trackReplacement(restores, User, 'updateRole', async (id, role) => {
            calls.push({ id, role });
            return buildUser({ id, role });
        });

        const updated = await User.promoteToAdmin('user-2');

        expect(calls).toEqual([{ id: 'user-2', role: 'admin' }]);
        expect(updated.role).toBe('admin');
    });
});