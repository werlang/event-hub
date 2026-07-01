import assert from 'node:assert/strict';
import test from 'node:test';

import { AuthApi } from '../src/js/model/auth.js';
import { EventApi } from '../src/js/model/events.js';
import { UserApi } from '../src/js/model/users.js';

function createClient() {
    const calls = [];

    return {
        calls,
        client: {
            request(path, options = {}) {
                const call = { path, options };
                calls.push(call);
                return Promise.resolve({ ok: true, data: call });
            },
        },
    };
}

test('EventApi builds public, owner, moderation, and write endpoints', async () => {
    const { client, calls } = createClient();
    const api = new EventApi({ client });

    await api.listPublic(new URLSearchParams({ from: '2026-04-01', to: '2026-04-05' }));
    await api.listMine('member-token');
    await api.listModeration('admin-token', { status: 'pending' });
    await api.create('member-token', { title: 'Mostra' });
    await api.update('member-token', 'evt-1', { title: 'Mostra atualizada' });
    await api.delete('admin-token', 'evt-2');
    await api.moderate('admin-token', 'evt-3', { status: 'published' });

    assert.deepEqual(calls, [
        { path: '/events?from=2026-04-01&to=2026-04-05', options: {} },
        { path: '/events/mine', options: { token: 'member-token' } },
        { path: '/events/moderation?status=pending', options: { token: 'admin-token' } },
        { path: '/events', options: { method: 'POST', token: 'member-token', body: { title: 'Mostra' } } },
        { path: '/events/evt-1', options: { method: 'PUT', token: 'member-token', body: { title: 'Mostra atualizada' } } },
        { path: '/events/evt-2', options: { method: 'DELETE', token: 'admin-token' } },
        { path: '/events/evt-3/moderation', options: { method: 'PUT', token: 'admin-token', body: { status: 'published' } } },
    ]);
});

test('AuthApi preserves response envelopes while centralizing auth paths and token storage', async () => {
    const { client, calls } = createClient();
    const stored = [];
    const tokenStore = {
        read: () => stored.at(-1) || null,
        store: token => stored.push(token),
        clear: () => stored.push(null),
    };
    const api = new AuthApi({ client, tokenStore });

    const response = await api.login({ email: 'ada@example.com', password: 'secret' });
    await api.register({ name: 'Ada', email: 'ada@example.com', password: 'secret' });
    await api.current('token-1');
    await api.updateProfile('token-1', { name: 'Ada Lovelace' });
    await api.changePassword('token-1', { currentPassword: 'old', newPassword: 'new' });
    await api.updatePreferences('token-1', { eventUpdates: false });
    await api.sendWeeklyDigest('admin-token', { timezone: 'America/Sao_Paulo' });
    api.storeToken('token-1');
    api.clearToken();

    assert.equal(response.ok, true);
    assert.deepEqual(calls.map(call => call.path), [
        '/auth/login',
        '/auth/register',
        '/auth/me',
        '/auth/me',
        '/auth/password',
        '/auth/me/preferences',
        '/auth/weekly-digest/send',
    ]);
    assert.deepEqual(calls.at(5).options.body, { emailPreferences: { eventUpdates: false } });
    assert.deepEqual(stored, ['token-1', null]);
});

test('UserApi centralizes self-service and administrator user endpoints', async () => {
    const { client, calls } = createClient();
    const api = new UserApi({ client });

    await api.requestPasswordReset('ada@example.com');
    await api.confirmPasswordReset({ token: 'reset-token', newPassword: 'new-password' });
    await api.list('admin-token');
    await api.adminResetPassword('admin-token', { email: 'ada@example.com', newPassword: 'temporary' });
    await api.promote('admin-token', 'user-1');

    assert.deepEqual(calls, [
        { path: '/users/password-reset', options: { method: 'POST', body: { email: 'ada@example.com' } } },
        { path: '/users/password-reset', options: { method: 'PUT', body: { token: 'reset-token', newPassword: 'new-password' } } },
        { path: '/users', options: { token: 'admin-token' } },
        { path: '/users/password/reset', options: { method: 'PUT', token: 'admin-token', body: { email: 'ada@example.com', newPassword: 'temporary' } } },
        { path: '/users/user-1/promote', options: { method: 'PUT', token: 'admin-token' } },
    ]);
});

