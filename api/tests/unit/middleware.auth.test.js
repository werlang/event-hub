import { describe, expect, test } from '@jest/globals';
import { signToken } from '../../helpers/token.js';
import { authMiddleware } from '../../middleware/auth.js';

describe('middleware/auth', () => {
    test('rejects requests without an Authorization header', () => {
        const req = { headers: {} };
        const calls = [];

        authMiddleware(req, {}, error => {
            calls.push(error);
        });

        expect(calls[0].status).toBe(401);
        expect(calls[0].message).toBe('Autenticação necessária.');
    });

    test('rejects malformed bearer headers', () => {
        const req = { headers: { authorization: 'Token abc' } };
        const calls = [];

        authMiddleware(req, {}, error => {
            calls.push(error);
        });

        expect(calls[0].status).toBe(401);
        expect(calls[0].message).toBe('Autenticação necessária.');
    });

    test('exposes the decoded user for valid tokens', () => {
        const token = signToken({ id: 'user-1', role: 'admin' });
        const req = { headers: { authorization: `Bearer ${token}` } };
        const calls = [];

        authMiddleware(req, {}, error => {
            calls.push(error);
        });

        expect(calls[0]).toBeUndefined();
        expect(req.user.id).toBe('user-1');
        expect(req.user.role).toBe('admin');
    });

    test('maps invalid tokens to a 401 error', () => {
        const req = { headers: { authorization: 'Bearer not-a-token' } };
        const calls = [];

        authMiddleware(req, {}, error => {
            calls.push(error);
        });

        expect(calls[0].status).toBe(401);
        expect(calls[0].message).toBe('Sessão inválida ou expirada.');
    });
});