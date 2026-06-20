import crypto from 'crypto';
import { Model } from './model.js';

const TOKEN_BYTES = 32;
const TOKEN_EXPIRES_IN_MS = 15 * 60 * 1000;

/**
 * Normalizes a timestamp-like value into an ISO string when possible.
 */
function normalizeDateTime(value) {
    if (!value) {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Persists and verifies password-reset tokens without storing raw reset links.
 */
export class PasswordResetToken extends Model {
    static table = 'password_reset_tokens';
    static view = ['id', 'user_id', 'token_hash', 'expires_at', 'used_at', 'created_at'];
    static EXPIRES_IN_MS = TOKEN_EXPIRES_IN_MS;

    /**
     * Hashes a raw token so database disclosure does not expose active reset links.
     */
    static hashToken(token) {
        return crypto
            .createHash('sha256')
            .update(String(token || ''), 'utf8')
            .digest('hex');
    }

    /**
     * Generates the raw reset token that will be sent once by e-mail.
     */
    static generateToken() {
        return crypto.randomBytes(TOKEN_BYTES).toString('hex');
    }

    /**
     * Normalizes a raw token row into the application shape.
     */
    static normalize(row) {
        if (!row) return null;

        return {
            id: row.id,
            userId: row.userId || row.user_id,
            tokenHash: row.tokenHash || row.token_hash,
            expiresAt: normalizeDateTime(row.expiresAt || row.expires_at),
            usedAt: normalizeDateTime(row.usedAt || row.used_at),
            createdAt: normalizeDateTime(row.createdAt || row.created_at),
        };
    }

    /**
     * Serializes one reset-token payload into database column names.
     */
    static serialize(payload = {}) {
        return {
            id: payload.id,
            user_id: payload.userId,
            token_hash: payload.tokenHash,
            expires_at: this.driver.toDateTime(payload.expiresAt),
            used_at: payload.usedAt ? this.driver.toDateTime(payload.usedAt) : null,
            created_at: this.driver.toDateTime(payload.createdAt || Date.now()),
        };
    }

    /**
     * Creates a new one-time token for a user and returns the raw token once.
     */
    static async createForUser(userId, { now = new Date() } = {}) {
        if (!userId) {
            return null;
        }

        const issuedAt = now instanceof Date ? now : new Date(now);
        const token = this.generateToken();
        const record = {
            id: crypto.randomUUID(),
            userId,
            tokenHash: this.hashToken(token),
            expiresAt: new Date(issuedAt.getTime() + this.EXPIRES_IN_MS).toISOString(),
            usedAt: null,
            createdAt: issuedAt.toISOString(),
        };

        await this.insert(record);
        return {
            token,
            record: this.normalize(record),
        };
    }

    /**
     * Reads a token by raw value and returns it only while it can still be used.
     */
    static async findUsableByToken(token, { now = new Date() } = {}) {
        if (!token) {
            return null;
        }

        const record = await this.get({ token_hash: this.hashToken(token) });
        if (!record || record.usedAt) {
            return null;
        }

        const expiresAt = new Date(record.expiresAt);
        const referenceDate = now instanceof Date ? now : new Date(now);
        if (Number.isNaN(expiresAt.getTime()) || expiresAt <= referenceDate) {
            return null;
        }

        return record;
    }

    /**
     * Marks every active reset token for a user as used in one pass.
     */
    static async invalidateActiveForUser(userId, { now = new Date() } = {}) {
        if (!userId) {
            return null;
        }

        await this.driver.update(this.table, {
            used_at: this.driver.toDateTime(now),
        }, {
            user_id: userId,
            used_at: null,
        });

        return true;
    }
}
