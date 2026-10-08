import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { router as authRouter } from '../../routes/auth.js';
import { Email } from '../../helpers/email.js';
import { EmailVerificationEmailManager } from '../../helpers/email-verification-email-manager.js';
import { Event } from '../../model/event.js';
import { EmailVerificationToken } from '../../model/email-verification-token.js';
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
    jest.useRealTimers();
});

describe('routes/auth', () => {
    const registerHandlers = getRouteHandlers(authRouter, 'post', '/register');
    const verifyEmailHandlers = getRouteHandlers(authRouter, 'post', '/verify-email');
    const resendVerificationHandlers = getRouteHandlers(authRouter, 'post', '/verify-email/resend');
    const loginHandlers = getRouteHandlers(authRouter, 'post', '/login');
    const meHandlers = getRouteHandlers(authRouter, 'get', '/me').slice(1);
    const updateMeHandlers = getRouteHandlers(authRouter, 'put', '/me').slice(1);
    const updatePreferenceHandlers = getRouteHandlers(authRouter, 'put', '/me/preferences').slice(1);
    const passwordHandlers = getRouteHandlers(authRouter, 'put', '/password').slice(1);
    const manualDigestHandlers = getRouteHandlers(authRouter, 'post', '/weekly-digest/send').slice(1);

    test('register creates a pending account and sends the confirmation e-mail', async () => {
        const emailCalls = [];
        trackReplacement(restores, User, 'findByEmail', async () => null);
        trackReplacement(restores, User, 'create', async payload => buildUser({
            name: payload.name,
            email: payload.email.toLowerCase(),
            emailVerifiedAt: null,
        }));
        trackReplacement(restores, EmailVerificationToken, 'invalidateActiveForUser', async () => true);
        trackReplacement(restores, EmailVerificationToken, 'createForUser', async () => ({
            token: 'raw-verification-token',
            record: { id: 'token-1', userId: 'user-1' },
        }));
        trackReplacement(restores, EmailVerificationEmailManager.prototype, 'sendVerificationEmail', async (user, token) => {
            emailCalls.push({ user, token });
            return { messageId: 'msg:verification' };
        });

        const req = createRequest({
            body: {
                name: 'Ada Lovelace',
                email: 'ADA@EXAMPLE.COM',
                password: 'secret123',
            },
        });
        const res = createResponseDouble();
        const next = jest.fn();

        await runRouteHandlers(registerHandlers, req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(201);
        expect(res.body.data.user).toEqual({
            id: 'user-1',
            name: 'Ada Lovelace',
            email: 'ada@example.com',
            role: 'member',
            emailVerifiedAt: null,
            emailPreferences: {
                eventUpdates: true,
                adminPendingRequests: true,
            },
        });
        expect(res.body.data.verificationRequired).toBe(true);
        expect(res.body.data.token).toBeUndefined();
        expect(res.body.message).toBe('Cadastro recebido. Verifique seu e-mail para confirmar a conta.');
        expect(emailCalls).toEqual([{
            user: expect.objectContaining({ email: 'ada@example.com' }),
            token: 'raw-verification-token',
        }]);
    });

    test('register rejects missing fields, duplicates, and unexpected failures', async () => {
        const missingNext = jest.fn();
        await runRouteHandlers(registerHandlers, createRequest({ body: { name: 'Ada' } }), createResponseDouble(), missingNext);
        expect(missingNext.mock.calls[0][0].status).toBe(400);

        trackReplacement(restores, User, 'findByEmail', async () => buildUser());
        const duplicateNext = jest.fn();
        await runRouteHandlers(registerHandlers, createRequest({ body: { name: 'Ada', email: 'ada@example.com', password: 'secret123' } }), createResponseDouble(), duplicateNext);
        expect(duplicateNext.mock.calls[0][0].status).toBe(409);

        trackReplacement(restores, User, 'findByEmail', async () => null);
        trackReplacement(restores, User, 'create', async () => {
            throw new Error('db offline');
        });
        const unexpectedNext = jest.fn();
        await runRouteHandlers(registerHandlers, createRequest({ body: { name: 'Ada', email: 'ada@example.com', password: 'secret123' } }), createResponseDouble(), unexpectedNext);
        expect(unexpectedNext.mock.calls[0][0].status).toBe(500);
        expect(unexpectedNext.mock.calls[0][0].message).toBe('Não foi possível criar a conta.');
    });

    test('register silently discards honeypot submissions without creating accounts', async () => {
        const createCalls = [];
        const emailCalls = [];
        trackReplacement(restores, User, 'findByEmail', async () => {
            throw new Error('lookup must not run for spam');
        });
        trackReplacement(restores, User, 'create', async payload => {
            createCalls.push(payload);
            return buildUser(payload);
        });
        trackReplacement(restores, EmailVerificationEmailManager.prototype, 'sendVerificationEmail', async (user, token) => {
            emailCalls.push({ user, token });
            return { messageId: 'msg:verification' };
        });

        const res = createResponseDouble();
        const next = jest.fn();
        await runRouteHandlers(registerHandlers, createRequest({
            body: { name: 'Bot', email: 'bot@example.com', password: 'secret123', website: 'https://spam.example' },
        }), res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(201);
        expect(res.body.message).toBe('Cadastro recebido. Verifique seu e-mail para confirmar a conta.');
        expect(createCalls).toEqual([]);
        expect(emailCalls).toEqual([]);
    });

    test('verify-email confirms pending accounts and rejects invalid links', async () => {
        trackReplacement(restores, EmailVerificationToken, 'findUsableByToken', async token => (token === 'valid-token'
            ? { id: 'token-1', userId: 'user-1' }
            : null));
        trackReplacement(restores, User, 'findById', async id => buildUser({ id, emailVerifiedAt: null }));
        trackReplacement(restores, User, 'markEmailVerified', async id => buildUser({ id }));
        trackReplacement(restores, EmailVerificationToken, 'invalidateActiveForUser', async () => true);

        const successRes = createResponseDouble();
        const successNext = jest.fn();
        await runRouteHandlers(verifyEmailHandlers, createRequest({ body: { token: 'valid-token' } }), successRes, successNext);

        expect(successNext).not.toHaveBeenCalled();
        expect(successRes.body.message).toBe('E-mail confirmado. Você já pode entrar.');
        expect(successRes.body.data.user.emailVerifiedAt).toBe('2026-04-02T12:00:00.000Z');

        const invalidNext = jest.fn();
        await runRouteHandlers(verifyEmailHandlers, createRequest({ body: { token: 'used-token' } }), createResponseDouble(), invalidNext);
        expect(invalidNext.mock.calls[0][0].status).toBe(400);

        const missingNext = jest.fn();
        await runRouteHandlers(verifyEmailHandlers, createRequest({ body: {} }), createResponseDouble(), missingNext);
        expect(missingNext.mock.calls[0][0].status).toBe(400);
    });

    test('verify-email resend hides account eligibility behind a generic response', async () => {
        const emailCalls = [];
        trackReplacement(restores, User, 'findByEmail', async email => (email === 'pending@example.com'
            ? buildUser({ email, emailVerifiedAt: null })
            : buildUser({ email })));
        trackReplacement(restores, EmailVerificationToken, 'invalidateActiveForUser', async () => true);
        trackReplacement(restores, EmailVerificationToken, 'createForUser', async () => ({
            token: 'raw-verification-token',
            record: { id: 'token-1', userId: 'user-1' },
        }));
        trackReplacement(restores, EmailVerificationEmailManager.prototype, 'sendVerificationEmail', async (user, token) => {
            emailCalls.push({ user, token });
            return { messageId: 'msg:verification' };
        });

        const pendingRes = createResponseDouble();
        await runRouteHandlers(resendVerificationHandlers, createRequest({ body: { email: 'pending@example.com' } }), pendingRes, jest.fn());
        expect(pendingRes.statusCode).toBe(202);
        expect(emailCalls).toHaveLength(1);

        const verifiedRes = createResponseDouble();
        await runRouteHandlers(resendVerificationHandlers, createRequest({ body: { email: 'ada@example.com' } }), verifiedRes, jest.fn());
        expect(verifiedRes.statusCode).toBe(202);
        expect(emailCalls).toHaveLength(1);

        const missingNext = jest.fn();
        await runRouteHandlers(resendVerificationHandlers, createRequest({ body: {} }), createResponseDouble(), missingNext);
        expect(missingNext.mock.calls[0][0].status).toBe(400);
    });

    test('login rejects pending accounts until the e-mail is confirmed', async () => {
        trackReplacement(restores, User, 'findByEmail', async () => buildUser({
            passwordHash: User.hashPassword('secret123'),
            emailVerifiedAt: null,
        }));

        const next = jest.fn();
        await runRouteHandlers(loginHandlers, createRequest({ body: { email: 'ada@example.com', password: 'secret123' } }), createResponseDouble(), next);

        expect(next.mock.calls[0][0].status).toBe(403);
        expect(next.mock.calls[0][0].message).toBe('Confirme seu e-mail para acessar sua conta.');
    });

    test('me rejects pending accounts until the e-mail is confirmed', async () => {
        trackReplacement(restores, User, 'findById', async id => buildUser({ id, emailVerifiedAt: null }));

        const next = jest.fn();
        await runRouteHandlers(meHandlers, createRequest({ user: { id: 'user-1' } }), createResponseDouble(), next);

        expect(next.mock.calls[0][0].status).toBe(403);
    });

    test('login authenticates a user and rejects common credential failures', async () => {
        trackReplacement(restores, User, 'findByEmail', async () => buildUser({
            role: 'admin',
            passwordHash: User.hashPassword('secret123'),
        }));

        const successRes = createResponseDouble();
        const successNext = jest.fn();
        await runRouteHandlers(loginHandlers, createRequest({ body: { email: 'ada@example.com', password: 'secret123' } }), successRes, successNext);
        expect(successNext).not.toHaveBeenCalled();
        expect(successRes.body.data.user.role).toBe('admin');

        const missingNext = jest.fn();
        await runRouteHandlers(loginHandlers, createRequest({ body: { email: 'ada@example.com' } }), createResponseDouble(), missingNext);
        expect(missingNext.mock.calls[0][0].status).toBe(400);

        trackReplacement(restores, User, 'findByEmail', async () => null);
        const missingUserNext = jest.fn();
        await runRouteHandlers(loginHandlers, createRequest({ body: { email: 'ada@example.com', password: 'secret123' } }), createResponseDouble(), missingUserNext);
        expect(missingUserNext.mock.calls[0][0].status).toBe(401);

        trackReplacement(restores, User, 'findByEmail', async () => buildUser({
            passwordHash: User.hashPassword('correct-secret'),
        }));
        const wrongPasswordNext = jest.fn();
        await runRouteHandlers(loginHandlers, createRequest({ body: { email: 'ada@example.com', password: 'wrong-secret' } }), createResponseDouble(), wrongPasswordNext);
        expect(wrongPasswordNext.mock.calls[0][0].status).toBe(401);
    });

    test('login maps unexpected failures to a 500 error', async () => {
        trackReplacement(restores, User, 'findByEmail', async () => {
            throw new Error('lookup failed');
        });

        const next = jest.fn();
        await runRouteHandlers(loginHandlers, createRequest({ body: { email: 'ada@example.com', password: 'secret123' } }), createResponseDouble(), next);

        expect(next.mock.calls[0][0].status).toBe(500);
        expect(next.mock.calls[0][0].message).toBe('Não foi possível processar a autenticação.');
    });

    test('me returns the authenticated account and rejects expired sessions', async () => {
        trackReplacement(restores, User, 'findById', async id => buildUser({ id, role: 'admin' }));

        const successRes = createResponseDouble();
        const successNext = jest.fn();
        await runRouteHandlers(meHandlers, createRequest({ user: { id: 'user-1' } }), successRes, successNext);
        expect(successNext).not.toHaveBeenCalled();
        expect(successRes.body.data.user.role).toBe('admin');

        trackReplacement(restores, User, 'findById', async () => null);
        const expiredNext = jest.fn();
        await runRouteHandlers(meHandlers, createRequest({ user: { id: 'user-1' } }), createResponseDouble(), expiredNext);
        expect(expiredNext.mock.calls[0][0].status).toBe(401);
        expect(expiredNext.mock.calls[0][0].message).toBe('Sessão expirada.');
    });

    test('update me updates the authenticated profile, refreshes the token, and rejects duplicates', async () => {
        trackReplacement(restores, User, 'findById', async id => buildUser({ id, role: 'member' }));
        trackReplacement(restores, User, 'findByEmail', async email => {
            if (email === 'grace@example.com') {
                return buildUser({ id: 'user-9', email });
            }

            return buildUser({ id: 'user-1', email });
        });
        trackReplacement(restores, User, 'updateProfile', async (id, payload) => buildUser({ id, ...payload }));

        const successRes = createResponseDouble();
        const successNext = jest.fn();
        await runRouteHandlers(updateMeHandlers, createRequest({
            user: { id: 'user-1', role: 'member' },
            body: { name: 'Grace Hopper', email: 'ada@example.com' },
        }), successRes, successNext);
        expect(successNext).not.toHaveBeenCalled();
        expect(successRes.body.message).toBe('Perfil atualizado.');
        expect(successRes.body.data.user).toEqual({
            id: 'user-1',
            name: 'Grace Hopper',
            email: 'ada@example.com',
            role: 'member',
            emailVerifiedAt: '2026-04-02T12:00:00.000Z',
            emailPreferences: {
                eventUpdates: true,
                adminPendingRequests: true,
            },
        });
        expect(typeof successRes.body.data.token).toBe('string');

        const missingFieldsNext = jest.fn();
        await runRouteHandlers(updateMeHandlers, createRequest({
            user: { id: 'user-1', role: 'member' },
            body: { name: '', email: '' },
        }), createResponseDouble(), missingFieldsNext);
        expect(missingFieldsNext.mock.calls[0][0].status).toBe(400);

        const duplicateNext = jest.fn();
        await runRouteHandlers(updateMeHandlers, createRequest({
            user: { id: 'user-1', role: 'member' },
            body: { name: 'Grace Hopper', email: 'grace@example.com' },
        }), createResponseDouble(), duplicateNext);
        expect(duplicateNext.mock.calls[0][0].status).toBe(409);
    });

    test('update me maps unexpected failures to a 500 error', async () => {
        trackReplacement(restores, User, 'findById', async id => buildUser({ id, role: 'member' }));
        trackReplacement(restores, User, 'findByEmail', async () => null);
        trackReplacement(restores, User, 'updateProfile', async () => {
            throw new Error('write failed');
        });

        const next = jest.fn();
        await runRouteHandlers(updateMeHandlers, createRequest({
            user: { id: 'user-1', role: 'member' },
            body: { name: 'Grace Hopper', email: 'grace@example.com' },
        }), createResponseDouble(), next);

        expect(next.mock.calls[0][0].status).toBe(500);
        expect(next.mock.calls[0][0].message).toBe('Não foi possível atualizar o perfil.');
    });

    test('update preferences stores the authenticated email flags and validates the payload', async () => {
        trackReplacement(restores, User, 'findById', async id => buildUser({ id, role: 'member' }));
        trackReplacement(restores, User, 'updateEmailPreferences', async (id, preferences) => buildUser({
            id,
            emailPreferences: preferences,
        }));

        const successRes = createResponseDouble();
        const successNext = jest.fn();
        await runRouteHandlers(updatePreferenceHandlers, createRequest({
            user: { id: 'user-1', role: 'member' },
            body: {
                emailPreferences: {
                    eventUpdates: true,
                },
            },
        }), successRes, successNext);

        expect(successNext).not.toHaveBeenCalled();
        expect(successRes.body.message).toBe('Preferências de e-mail atualizadas.');
        expect(successRes.body.data.user).toEqual({
            id: 'user-1',
            name: 'Ada Lovelace',
            email: 'ada@example.com',
            role: 'member',
            emailVerifiedAt: '2026-04-02T12:00:00.000Z',
            emailPreferences: {
                eventUpdates: true,
                adminPendingRequests: true,
            },
        });

        const missingPayloadNext = jest.fn();
        await runRouteHandlers(updatePreferenceHandlers, createRequest({
            user: { id: 'user-1', role: 'member' },
            body: {},
        }), createResponseDouble(), missingPayloadNext);
        expect(missingPayloadNext.mock.calls[0][0].status).toBe(400);

        const invalidFlagNext = jest.fn();
        await runRouteHandlers(updatePreferenceHandlers, createRequest({
            user: { id: 'user-1', role: 'member' },
            body: {
                emailPreferences: {
                    eventUpdates: 'yes',
                },
            },
        }), createResponseDouble(), invalidFlagNext);
        expect(invalidFlagNext.mock.calls[0][0].status).toBe(400);

        const invalidAdminFlagNext = jest.fn();
        await runRouteHandlers(updatePreferenceHandlers, createRequest({
            user: { id: 'admin-1', role: 'admin' },
            body: {
                emailPreferences: {
                    eventUpdates: true,
                    adminPendingRequests: 'yes',
                },
            },
        }), createResponseDouble(), invalidAdminFlagNext);
        expect(invalidAdminFlagNext.mock.calls[0][0].status).toBe(400);
    });

    test('update preferences maps unexpected failures to a 500 error', async () => {
        trackReplacement(restores, User, 'findById', async id => buildUser({ id, role: 'member' }));
        trackReplacement(restores, User, 'updateEmailPreferences', async () => {
            throw new Error('write failed');
        });

        const next = jest.fn();
        await runRouteHandlers(updatePreferenceHandlers, createRequest({
            user: { id: 'user-1', role: 'member' },
            body: {
                emailPreferences: {
                    eventUpdates: true,
                },
            },
        }), createResponseDouble(), next);

        expect(next.mock.calls[0][0].status).toBe(500);
        expect(next.mock.calls[0][0].message).toBe('Não foi possível atualizar as preferências de e-mail.');
    });

    test('password validates the payload, current password, and update flow', async () => {
        trackReplacement(restores, User, 'findById', async id => buildUser({
            id,
            passwordHash: User.hashPassword('current-secret'),
        }));
        trackReplacement(restores, User, 'updatePassword', async id => buildUser({ id }));

        const successRes = createResponseDouble();
        const successNext = jest.fn();
        await runRouteHandlers(passwordHandlers, createRequest({
            user: { id: 'user-1' },
            body: { currentPassword: 'current-secret', newPassword: 'new-secret' },
        }), successRes, successNext);
        expect(successNext).not.toHaveBeenCalled();
        expect(successRes.body.message).toBe('Senha atualizada.');

        const samePasswordNext = jest.fn();
        await runRouteHandlers(passwordHandlers, createRequest({
            user: { id: 'user-1' },
            body: { currentPassword: 'same-password', newPassword: 'same-password' },
        }), createResponseDouble(), samePasswordNext);
        expect(samePasswordNext.mock.calls[0][0].status).toBe(400);

        const missingFieldsNext = jest.fn();
        await runRouteHandlers(passwordHandlers, createRequest({
            user: { id: 'user-1' },
            body: { currentPassword: '', newPassword: '' },
        }), createResponseDouble(), missingFieldsNext);
        expect(missingFieldsNext.mock.calls[0][0].status).toBe(400);

        const wrongPasswordNext = jest.fn();
        await runRouteHandlers(passwordHandlers, createRequest({
            user: { id: 'user-1' },
            body: { currentPassword: 'wrong-secret', newPassword: 'new-secret' },
        }), createResponseDouble(), wrongPasswordNext);
        expect(wrongPasswordNext.mock.calls[0][0].status).toBe(401);
    });

    test('password maps unexpected update failures to a 500 error', async () => {
        trackReplacement(restores, User, 'findById', async id => buildUser({
            id,
            passwordHash: User.hashPassword('current-secret'),
        }));
        trackReplacement(restores, User, 'updatePassword', async () => {
            throw new Error('write failed');
        });

        const next = jest.fn();
        await runRouteHandlers(passwordHandlers, createRequest({
            user: { id: 'user-1' },
            body: { currentPassword: 'current-secret', newPassword: 'new-secret' },
        }), createResponseDouble(), next);

        expect(next.mock.calls[0][0].status).toBe(500);
        expect(next.mock.calls[0][0].message).toBe('Não foi possível atualizar a senha.');
    });

    test('manual weekly digest sending requires an admin and returns the manual trigger summary', async () => {
        jest.useFakeTimers({ now: new Date('2026-04-11T12:30:00.000Z').getTime() });

        const listCurrentWeekCalls = [];
        trackReplacement(restores, User, 'findById', async id => buildUser({ id, role: 'admin' }));
        trackReplacement(restores, User, 'list', async () => [buildUser({ email: 'docente@ifsul.edu.br' })]);
        trackReplacement(restores, Event, 'listCurrentWeek', async (...args) => {
            listCurrentWeekCalls.push(args);
            return [buildEvent({ status: 'published' })];
        });
        trackReplacement(restores, Email.prototype, 'send', async () => ({ messageId: 'msg:weekly-digest' }));

        const successRes = createResponseDouble();
        const successNext = jest.fn();
        await runRouteHandlers(manualDigestHandlers, createRequest({
            body: { timezone: 'Pacific/Kiritimati' },
            user: { id: 'admin-1', role: 'admin' },
        }), successRes, successNext);

        expect(successNext).not.toHaveBeenCalled();
        expect(successRes.body.message).toBe('Email da agenda semanal enviado com sucesso.');
        expect(successRes.body.data.digest).toMatchObject({
            eventCount: 1,
            recipientCount: 4,
            sentCount: 1,
        });
        expect(successRes.body.data.digest.weekRange).toEqual({
            from: '2026-04-12',
            to: '2026-04-18',
        });
        expect(successRes.body.data.digest.manualTriggeredAt).toBe('2026-04-11T12:30:00.000Z');
        expect(successRes.body.data.digest.manualTriggeredAtLabel).toBe('12/04, 02:30');
        expect(listCurrentWeekCalls).toEqual([[
            new Date('2026-04-11T12:30:00.000Z'),
            { timeZone: 'Pacific/Kiritimati' },
        ]]);

        const invalidTimeZoneNext = jest.fn();
        await runRouteHandlers(manualDigestHandlers, createRequest({
            body: { timezone: 'Mars/Olympus' },
            user: { id: 'admin-1', role: 'admin' },
        }), createResponseDouble(), invalidTimeZoneNext);
        expect(invalidTimeZoneNext.mock.calls[0][0].status).toBe(400);
        expect(invalidTimeZoneNext.mock.calls[0][0].message).toBe('Informe um fuso horário válido.');

        const forbiddenNext = jest.fn();
        await runRouteHandlers(manualDigestHandlers, createRequest({
            user: { id: 'user-1', role: 'member' },
        }), createResponseDouble(), forbiddenNext);
        expect(forbiddenNext.mock.calls[0][0].status).toBe(403);
    });
});
