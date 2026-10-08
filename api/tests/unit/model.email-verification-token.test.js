import { afterEach, describe, expect, test } from '@jest/globals';
import { EmailVerificationToken } from '../../model/email-verification-token.js';
import { restoreTracked, trackReplacement } from './support/doubles.js';

const restores = [];

afterEach(() => {
    restoreTracked(restores);
});

describe('model/email-verification-token', () => {
    test('hashToken is deterministic and generateToken returns a raw link token', () => {
        const hash = EmailVerificationToken.hashToken('verification-token');

        expect(hash).toBe(EmailVerificationToken.hashToken('verification-token'));
        expect(hash).not.toBe('verification-token');
        expect(hash).toHaveLength(64);
        expect(EmailVerificationToken.generateToken()).toHaveLength(64);
    });

    test('normalize and serialize map database fields and datetimes', () => {
        trackReplacement(restores, EmailVerificationToken, 'driver', {
            toDateTime(value) {
                return `mysql:${value}`;
            },
        });

        expect(EmailVerificationToken.normalize({
            id: 'token-1',
            user_id: 'user-1',
            token_hash: 'hash',
            expires_at: '2026-04-03T12:00:00.000Z',
            used_at: null,
            created_at: '2026-04-02T12:00:00.000Z',
        })).toEqual({
            id: 'token-1',
            userId: 'user-1',
            tokenHash: 'hash',
            expiresAt: '2026-04-03T12:00:00.000Z',
            usedAt: null,
            createdAt: '2026-04-02T12:00:00.000Z',
        });

        expect(EmailVerificationToken.serialize({
            id: 'token-1',
            userId: 'user-1',
            tokenHash: 'hash',
            expiresAt: '2026-04-03T12:00:00.000Z',
            usedAt: null,
            createdAt: '2026-04-02T12:00:00.000Z',
        })).toEqual({
            id: 'token-1',
            user_id: 'user-1',
            token_hash: 'hash',
            expires_at: 'mysql:2026-04-03T12:00:00.000Z',
            used_at: null,
            created_at: 'mysql:2026-04-02T12:00:00.000Z',
        });
    });

    test('createForUser stores only the token hash and a twenty-four-hour expiry', async () => {
        const insertCalls = [];
        trackReplacement(restores, EmailVerificationToken, 'insert', async payload => {
            insertCalls.push(payload);
            return payload;
        });

        const result = await EmailVerificationToken.createForUser('user-1', {
            now: new Date('2026-04-02T12:00:00.000Z'),
        });

        expect(result.token).toHaveLength(64);
        expect(insertCalls).toEqual([expect.objectContaining({
            userId: 'user-1',
            tokenHash: EmailVerificationToken.hashToken(result.token),
            expiresAt: '2026-04-03T12:00:00.000Z',
            usedAt: null,
            createdAt: '2026-04-02T12:00:00.000Z',
        })]);
        expect(insertCalls[0].tokenHash).not.toBe(result.token);
    });

    test('findUsableByToken rejects missing, used, and expired tokens', async () => {
        const tokenRows = new Map([
            ['valid', { id: 'token-valid', userId: 'user-1', expiresAt: '2026-04-03T12:00:00.000Z', usedAt: null }],
            ['used', { id: 'token-used', userId: 'user-1', expiresAt: '2026-04-03T12:00:00.000Z', usedAt: '2026-04-02T13:00:00.000Z' }],
            ['expired', { id: 'token-expired', userId: 'user-1', expiresAt: '2026-04-02T12:00:00.000Z', usedAt: null }],
        ]);
        trackReplacement(restores, EmailVerificationToken, 'get', async clause => {
            const requested = Array.from(tokenRows.values()).find(row => EmailVerificationToken.hashToken(row.id.replace('token-', '')) === clause.token_hash);
            return requested || null;
        });

        await expect(EmailVerificationToken.findUsableByToken('valid', {
            now: new Date('2026-04-02T13:00:00.000Z'),
        })).resolves.toEqual(tokenRows.get('valid'));
        await expect(EmailVerificationToken.findUsableByToken('used', {
            now: new Date('2026-04-02T13:00:00.000Z'),
        })).resolves.toBeNull();
        await expect(EmailVerificationToken.findUsableByToken('expired', {
            now: new Date('2026-04-02T13:00:00.000Z'),
        })).resolves.toBeNull();
        await expect(EmailVerificationToken.findUsableByToken('', {
            now: new Date('2026-04-02T13:00:00.000Z'),
        })).resolves.toBeNull();
    });

    test('invalidateActiveForUser persists used timestamps through the driver', async () => {
        const updateCalls = [];
        trackReplacement(restores, EmailVerificationToken, 'driver', {
            toDateTime(value) {
                return `mysql:${value instanceof Date ? value.toISOString() : value}`;
            },
            async update(table, payload, clause) {
                updateCalls.push({ table, payload, clause });
            },
        });

        await expect(EmailVerificationToken.invalidateActiveForUser('user-1', {
            now: new Date('2026-04-02T12:04:00.000Z'),
        })).resolves.toBe(true);

        expect(updateCalls).toEqual([
            {
                table: 'email_verification_tokens',
                payload: { used_at: 'mysql:2026-04-02T12:04:00.000Z' },
                clause: {
                    user_id: 'user-1',
                    used_at: null,
                },
            },
        ]);
    });
});
