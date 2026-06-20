import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { PasswordResetEmailManager } from '../../helpers/password-reset-email-manager.js';
import { PasswordResetToken } from '../../model/password-reset-token.js';
import { User } from '../../model/user.js';
import { router as usersRouter } from '../../routes/users.js';
import { buildUser } from './support/fixtures.js';
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

describe('routes/users', () => {
    const requestResetHandlers = getRouteHandlers(usersRouter, 'post', '/password-reset');
    const confirmResetHandlers = getRouteHandlers(usersRouter, 'put', '/password-reset');
    const adminResetHandlers = getRouteHandlers(usersRouter, 'put', '/password/reset').slice(1);
    const usersHandlers = getRouteHandlers(usersRouter, 'get', '/').slice(1);
    const promoteHandlers = getRouteHandlers(usersRouter, 'put', '/:id/promote').slice(1);

    test('password-reset request sends a reset link for known users and hides unknown accounts', async () => {
        const createTokenCalls = [];
        const emailCalls = [];
        trackReplacement(restores, User, 'findByEmail', async email => (email === 'ada@example.com' ? buildUser({ email }) : null));
        trackReplacement(restores, PasswordResetToken, 'createForUser', async (userId) => {
            createTokenCalls.push(userId);
            return {
                token: 'raw-reset-token',
                record: { id: 'token-1', userId },
            };
        });
        trackReplacement(restores, PasswordResetEmailManager.prototype, 'sendPasswordResetEmail', async (user, token) => {
            emailCalls.push({ user, token });
            return { messageId: 'msg:reset' };
        });

        const successRes = createResponseDouble();
        const successNext = jest.fn();
        await runRouteHandlers(requestResetHandlers, createRequest({
            body: { email: ' ADA@example.com ' },
        }), successRes, successNext);

        expect(successNext).not.toHaveBeenCalled();
        expect(successRes.body.message).toBe('Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.');
        expect(createTokenCalls).toEqual(['user-1']);
        expect(emailCalls).toEqual([{
            user: expect.objectContaining({ email: 'ada@example.com' }),
            token: 'raw-reset-token',
        }]);

        const hiddenRes = createResponseDouble();
        const hiddenNext = jest.fn();
        await runRouteHandlers(requestResetHandlers, createRequest({
            body: { email: 'missing@example.com' },
        }), hiddenRes, hiddenNext);

        expect(hiddenNext).not.toHaveBeenCalled();
        expect(hiddenRes.body.message).toBe('Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.');
        expect(createTokenCalls).toEqual(['user-1']);
        expect(emailCalls).toHaveLength(1);

        const missingEmailNext = jest.fn();
        await runRouteHandlers(requestResetHandlers, createRequest({
            body: { email: '' },
        }), createResponseDouble(), missingEmailNext);
        expect(missingEmailNext.mock.calls[0][0].status).toBe(400);
    });

    test('password-reset request maps unexpected failures to a 500 error', async () => {
        trackReplacement(restores, User, 'findByEmail', async () => buildUser());
        trackReplacement(restores, PasswordResetToken, 'createForUser', async () => {
            throw new Error('token failed');
        });

        const next = jest.fn();
        await runRouteHandlers(requestResetHandlers, createRequest({
            body: { email: 'ada@example.com' },
        }), createResponseDouble(), next);

        expect(next.mock.calls[0][0].status).toBe(500);
        expect(next.mock.calls[0][0].message).toBe('Não foi possível solicitar a redefinição de senha.');
    });

    test('password-reset confirmation consumes valid tokens and rejects invalid links', async () => {
        const calls = [];
        trackReplacement(restores, PasswordResetToken, 'findUsableByToken', async token => (token === 'valid-token'
            ? { id: 'token-1', userId: 'user-1' }
            : null));
        trackReplacement(restores, User, 'findById', async id => buildUser({ id }));
        trackReplacement(restores, User, 'updatePassword', async (id, password) => {
            calls.push({ method: 'updatePassword', id, password });
            return buildUser({ id });
        });
        trackReplacement(restores, PasswordResetToken, 'invalidateActiveForUser', async (userId, options) => {
            calls.push({ method: 'invalidateActiveForUser', userId, options });
            return true;
        });

        const successRes = createResponseDouble();
        const successNext = jest.fn();
        await runRouteHandlers(confirmResetHandlers, createRequest({
            body: { token: 'valid-token', newPassword: 'nova-senha' },
        }), successRes, successNext);

        expect(successNext).not.toHaveBeenCalled();
        expect(successRes.body.message).toBe('Senha redefinida. Você já pode entrar com a nova senha.');
        expect(calls).toEqual([
            { method: 'updatePassword', id: 'user-1', password: 'nova-senha' },
            { method: 'invalidateActiveForUser', userId: 'user-1', options: undefined },
        ]);

        const invalidNext = jest.fn();
        await runRouteHandlers(confirmResetHandlers, createRequest({
            body: { token: 'expired-token', newPassword: 'nova-senha' },
        }), createResponseDouble(), invalidNext);
        expect(invalidNext.mock.calls[0][0].status).toBe(400);
        expect(invalidNext.mock.calls[0][0].message).toBe('Link de redefinição inválido ou expirado.');

        const missingPayloadNext = jest.fn();
        await runRouteHandlers(confirmResetHandlers, createRequest({
            body: { token: '', newPassword: '' },
        }), createResponseDouble(), missingPayloadNext);
        expect(missingPayloadNext.mock.calls[0][0].status).toBe(400);
    });

    test('password-reset confirmation maps missing accounts and unexpected failures', async () => {
        trackReplacement(restores, PasswordResetToken, 'findUsableByToken', async () => ({ id: 'token-1', userId: 'user-9' }));
        trackReplacement(restores, User, 'findById', async () => null);

        const missingUserNext = jest.fn();
        await runRouteHandlers(confirmResetHandlers, createRequest({
            body: { token: 'valid-token', newPassword: 'nova-senha' },
        }), createResponseDouble(), missingUserNext);
        expect(missingUserNext.mock.calls[0][0].status).toBe(400);

        trackReplacement(restores, User, 'findById', async id => buildUser({ id }));
        trackReplacement(restores, User, 'updatePassword', async () => {
            throw new Error('write failed');
        });

        const failedNext = jest.fn();
        await runRouteHandlers(confirmResetHandlers, createRequest({
            body: { token: 'valid-token', newPassword: 'nova-senha' },
        }), createResponseDouble(), failedNext);
        expect(failedNext.mock.calls[0][0].status).toBe(500);
        expect(failedNext.mock.calls[0][0].message).toBe('Não foi possível redefinir a senha.');
    });

    test('admin password reset handles success, validation, missing users, admin targets, and forbidden actors', async () => {
        trackReplacement(restores, User, 'findById', async id => buildUser({ id, role: id === 'admin-1' ? 'admin' : 'member' }));
        trackReplacement(restores, User, 'findByEmail', async email => {
            if (email === 'missing@example.com') {
                return null;
            }

            if (email === 'admin@example.com') {
                return buildUser({ id: 'admin-2', email, role: 'admin' });
            }

            return buildUser({ id: 'user-2', email, role: 'member' });
        });
        trackReplacement(restores, User, 'updatePassword', async id => buildUser({ id, email: 'member@example.com', role: 'member' }));

        const successRes = createResponseDouble();
        const successNext = jest.fn();
        await runRouteHandlers(adminResetHandlers, createRequest({
            user: { id: 'admin-1', role: 'admin' },
            body: { email: 'member@example.com', newPassword: 'reset-secret' },
        }), successRes, successNext);
        expect(successNext).not.toHaveBeenCalled();
        expect(successRes.body.message).toBe('Senha do usuário atualizada.');
        expect(successRes.body.data.user.email).toBe('member@example.com');

        const missingFieldsNext = jest.fn();
        await runRouteHandlers(adminResetHandlers, createRequest({
            user: { id: 'admin-1', role: 'admin' },
            body: { email: '', newPassword: '' },
        }), createResponseDouble(), missingFieldsNext);
        expect(missingFieldsNext.mock.calls[0][0].status).toBe(400);

        const missingUserNext = jest.fn();
        await runRouteHandlers(adminResetHandlers, createRequest({
            user: { id: 'admin-1', role: 'admin' },
            body: { email: 'missing@example.com', newPassword: 'reset-secret' },
        }), createResponseDouble(), missingUserNext);
        expect(missingUserNext.mock.calls[0][0].status).toBe(404);

        const adminTargetNext = jest.fn();
        await runRouteHandlers(adminResetHandlers, createRequest({
            user: { id: 'admin-1', role: 'admin' },
            body: { email: 'admin@example.com', newPassword: 'reset-secret' },
        }), createResponseDouble(), adminTargetNext);
        expect(adminTargetNext.mock.calls[0][0].status).toBe(400);

        const forbiddenNext = jest.fn();
        await runRouteHandlers(adminResetHandlers, createRequest({
            user: { id: 'user-1', role: 'member' },
            body: { email: 'member@example.com', newPassword: 'reset-secret' },
        }), createResponseDouble(), forbiddenNext);
        expect(forbiddenNext.mock.calls[0][0].status).toBe(403);
    });

    test('admin password reset maps unexpected failures to a 500 error', async () => {
        trackReplacement(restores, User, 'findById', async id => buildUser({ id, role: 'admin' }));
        trackReplacement(restores, User, 'findByEmail', async () => buildUser({ id: 'user-2', role: 'member', email: 'member@example.com' }));
        trackReplacement(restores, User, 'updatePassword', async () => {
            throw new Error('write failed');
        });

        const next = jest.fn();
        await runRouteHandlers(adminResetHandlers, createRequest({
            user: { id: 'admin-1', role: 'admin' },
            body: { email: 'member@example.com', newPassword: 'reset-secret' },
        }), createResponseDouble(), next);

        expect(next.mock.calls[0][0].status).toBe(500);
        expect(next.mock.calls[0][0].message).toBe('Não foi possível redefinir a senha do usuário.');
    });

    test('users returns safe records only for administrators', async () => {
        trackReplacement(restores, User, 'findById', async id => buildUser({ id, role: 'admin' }));
        trackReplacement(restores, User, 'listForAdministration', async () => [buildUser({ id: 'user-2', name: 'Grace Hopper' })]);

        const successRes = createResponseDouble();
        const successNext = jest.fn();
        await runRouteHandlers(usersHandlers, createRequest({ user: { id: 'admin-1', role: 'admin' } }), successRes, successNext);
        expect(successNext).not.toHaveBeenCalled();
        expect(successRes.body.data.users).toEqual([{
            id: 'user-2',
            name: 'Grace Hopper',
            email: 'ada@example.com',
            role: 'member',
            emailPreferences: {
                eventUpdates: true,
                adminPendingRequests: true,
            },
        }]);

        trackReplacement(restores, User, 'findById', async id => buildUser({ id, role: 'member' }));
        const forbiddenNext = jest.fn();
        await runRouteHandlers(usersHandlers, createRequest({ user: { id: 'user-1', role: 'member' } }), createResponseDouble(), forbiddenNext);
        expect(forbiddenNext.mock.calls[0][0].status).toBe(403);
    });

    test('users maps unexpected list failures to a 500 error', async () => {
        trackReplacement(restores, User, 'findById', async id => buildUser({ id, role: 'admin' }));
        trackReplacement(restores, User, 'listForAdministration', async () => {
            throw new Error('read failed');
        });

        const next = jest.fn();
        await runRouteHandlers(usersHandlers, createRequest({ user: { id: 'admin-1', role: 'admin' } }), createResponseDouble(), next);

        expect(next.mock.calls[0][0].status).toBe(500);
        expect(next.mock.calls[0][0].message).toBe('Não foi possível carregar os usuários.');
    });

    test('promote handles the common admin workflows and edge cases', async () => {
        trackReplacement(restores, User, 'findById', async id => {
            if (id === 'admin-1') {
                return buildUser({ id, role: 'admin' });
            }

            return buildUser({ id, role: 'member' });
        });
        trackReplacement(restores, User, 'promoteToAdmin', async id => buildUser({ id, role: 'admin' }));

        const successRes = createResponseDouble();
        const successNext = jest.fn();
        await runRouteHandlers(promoteHandlers, createRequest({ user: { id: 'admin-1', role: 'admin' }, params: { id: 'user-2' } }), successRes, successNext);
        expect(successNext).not.toHaveBeenCalled();
        expect(successRes.body.message).toBe('Usuário promovido a administrador.');

        trackReplacement(restores, User, 'findById', async id => (id === 'admin-1' ? buildUser({ id, role: 'admin' }) : null));
        const missingNext = jest.fn();
        await runRouteHandlers(promoteHandlers, createRequest({ user: { id: 'admin-1', role: 'admin' }, params: { id: 'user-9' } }), createResponseDouble(), missingNext);
        expect(missingNext.mock.calls[0][0].status).toBe(404);

        trackReplacement(restores, User, 'findById', async id => buildUser({ id, role: 'admin' }));
        const selfNext = jest.fn();
        await runRouteHandlers(promoteHandlers, createRequest({ user: { id: 'admin-1', role: 'admin' }, params: { id: 'admin-1' } }), createResponseDouble(), selfNext);
        expect(selfNext.mock.calls[0][0].status).toBe(403);

        trackReplacement(restores, User, 'findById', async id => {
            if (id === 'admin-1') {
                return buildUser({ id, role: 'admin' });
            }

            return buildUser({ id, role: 'admin' });
        });
        const alreadyAdminNext = jest.fn();
        await runRouteHandlers(promoteHandlers, createRequest({ user: { id: 'admin-1', role: 'admin' }, params: { id: 'user-3' } }), createResponseDouble(), alreadyAdminNext);
        expect(alreadyAdminNext.mock.calls[0][0].status).toBe(400);
    });

    test('promote maps unexpected failures to a 500 error', async () => {
        trackReplacement(restores, User, 'findById', async id => {
            if (id === 'admin-1') {
                return buildUser({ id, role: 'admin' });
            }

            return buildUser({ id, role: 'member' });
        });
        trackReplacement(restores, User, 'promoteToAdmin', async () => {
            throw new Error('write failed');
        });

        const next = jest.fn();
        await runRouteHandlers(promoteHandlers, createRequest({ user: { id: 'admin-1', role: 'admin' }, params: { id: 'user-2' } }), createResponseDouble(), next);

        expect(next.mock.calls[0][0].status).toBe(500);
        expect(next.mock.calls[0][0].message).toBe('Não foi possível promover o usuário.');
    });
});
