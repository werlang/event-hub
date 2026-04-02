import { beforeEach, describe, expect, jest, test } from '@jest/globals';

const tokenModuleUrl = new URL('../../helpers/token.js', import.meta.url);

beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    jest.resetModules();
});

describe('helpers/token', () => {
    test('signToken and verifyToken round-trip an authenticated payload', async () => {
        const { signToken, verifyToken } = await import(tokenModuleUrl);
        const token = signToken({
            id: 'user-1',
            email: 'ada@example.com',
            role: 'admin',
        });

        const decoded = verifyToken(token);

        expect(decoded.id).toBe('user-1');
        expect(decoded.email).toBe('ada@example.com');
        expect(decoded.role).toBe('admin');
        expect(decoded.sub).toBe('user-1');
    });

    test('verifyToken rejects malformed tokens', async () => {
        const { verifyToken } = await import(tokenModuleUrl);
        expect(() => verifyToken('not-a-token')).toThrow(/token|jwt/i);
    });

    test('token helpers require JWT_SECRET when the module is imported', async () => {
        delete process.env.JWT_SECRET;

        await expect(import(tokenModuleUrl)).rejects.toThrow('JWT_SECRET must be configured');
    });
});