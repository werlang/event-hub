import { afterEach, describe, expect, test } from '@jest/globals';
import { PasswordResetToken } from '../../model/password-reset-token.js';
import { restoreTracked, trackReplacement } from './support/doubles.js';

const restores = [];

afterEach(() => {
    restoreTracked(restores);
});

describe('model/password-reset-token', () => {
    test('hashToken is deterministic and generateToken returns a raw link token', () => {
        const hash = PasswordResetToken.hashToken('reset-token');

        expect(hash).toBe(PasswordResetToken.hashToken('reset-token'));
        expect(hash).not.toBe('reset-token');
        expect(hash).toHaveLength(64);
        expect(PasswordResetToken.generateToken()).toHaveLength(64);
    });

    test('normalize and serialize map database fields and datetimes', () => {
        trackReplacement(restores, PasswordResetToken, 'driver', {
            toDateTime(value) {
                return `mysql:${value}`;
            },
        });

        expect(PasswordResetToken.normalize({
            id: 'token-1',
            user_id: 'user-1',
            token_hash: 'hash',
            expires_at: '2026-04-02T12:15:00.000Z',
            used_at: null,
            created_at: '2026-04-02T12:00:00.000Z',
        })).toEqual({
            id: 'token-1',
            userId: 'user-1',
            tokenHash: 'hash',
            expiresAt: '2026-04-02T12:15:00.000Z',
            usedAt: null,
            createdAt: '2026-04-02T12:00:00.000Z',
        });

        expect(PasswordResetToken.serialize({
            id: 'token-1',
            userId: 'user-1',
            tokenHash: 'hash',
            expiresAt: '2026-04-02T12:15:00.000Z',
            usedAt: null,
            createdAt: '2026-04-02T12:00:00.000Z',
        })).toEqual({
            id: 'token-1',
            user_id: 'user-1',
            token_hash: 'hash',
            expires_at: 'mysql:2026-04-02T12:15:00.000Z',
            used_at: null,
            created_at: 'mysql:2026-04-02T12:00:00.000Z',
        });
    });

    test('createForUser stores only the token hash and a fifteen-minute expiry', async () => {
        const insertCalls = [];
        trackReplacement(restores, PasswordResetToken, 'insert', async payload => {
            insertCalls.push(payload);
            return payload;
        });

        const result = await PasswordResetToken.createForUser('user-1', {
            now: new Date('2026-04-02T12:00:00.000Z'),
        });

        expect(result.token).toHaveLength(64);
        expect(insertCalls).toEqual([expect.objectContaining({
            userId: 'user-1',
            tokenHash: PasswordResetToken.hashToken(result.token),
            expiresAt: '2026-04-02T12:15:00.000Z',
            usedAt: null,
            createdAt: '2026-04-02T12:00:00.000Z',
        })]);
        expect(insertCalls[0].tokenHash).not.toBe(result.token);
    });

    test('findUsableByToken rejects missing, used, and expired tokens', async () => {
        const tokenRows = new Map([
            ['valid', { id: 'token-valid', userId: 'user-1', expiresAt: '2026-04-02T12:15:00.000Z', usedAt: null }],
            ['used', { id: 'token-used', userId: 'user-1', expiresAt: '2026-04-02T12:15:00.000Z', usedAt: '2026-04-02T12:01:00.000Z' }],
            ['expired', { id: 'token-expired', userId: 'user-1', expiresAt: '2026-04-02T12:00:00.000Z', usedAt: null }],
        ]);
        trackReplacement(restores, PasswordResetToken, 'get', async clause => {
            const requested = Array.from(tokenRows.values()).find(row => PasswordResetToken.hashToken(row.id.replace('token-', '')) === clause.token_hash);
            return requested || null;
        });

        await expect(PasswordResetToken.findUsableByToken('valid', {
            now: new Date('2026-04-02T12:10:00.000Z'),
        })).resolves.toEqual(tokenRows.get('valid'));
        await expect(PasswordResetToken.findUsableByToken('used', {
            now: new Date('2026-04-02T12:10:00.000Z'),
        })).resolves.toBeNull();
        await expect(PasswordResetToken.findUsableByToken('expired', {
            now: new Date('2026-04-02T12:10:00.000Z'),
        })).resolves.toBeNull();
        await expect(PasswordResetToken.findUsableByToken('', {
            now: new Date('2026-04-02T12:10:00.000Z'),
        })).resolves.toBeNull();
    });

    test('invalidateActiveForUser persists used timestamps through the driver', async () => {
        const updateCalls = [];
        trackReplacement(restores, PasswordResetToken, 'driver', {
            toDateTime(value) {
                return `mysql:${value instanceof Date ? value.toISOString() : value}`;
            },
            async update(table, payload, clause) {
                updateCalls.push({ table, payload, clause });
            },
        });

        await expect(PasswordResetToken.invalidateActiveForUser('user-1', {
            now: new Date('2026-04-02T12:04:00.000Z'),
        })).resolves.toBe(true);

        expect(updateCalls).toEqual([
            {
                table: 'password_reset_tokens',
                payload: { used_at: 'mysql:2026-04-02T12:04:00.000Z' },
                clause: {
                    user_id: 'user-1',
                    used_at: null,
                },
            },
        ]);
    });
});
