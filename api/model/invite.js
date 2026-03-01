import crypto from 'crypto';
import { Model } from './model.js';

export class Invite extends Model {

    static table = 'invites';
    static view = [
        'id',
        'token',
        'role',
        'expires_at',
        'used_at',
        'created_by',
        'created_at',
    ];

    constructor({
        id,
        token,
        role,
        expiresAt,
        usedAt,
        createdBy,
        createdAt,
    } = {}) {
        super();
        this.id = id || crypto.randomUUID();
        this.token = token || crypto.randomBytes(24).toString('hex');
        this.role = String(role || 'member').toLowerCase();
        this.expiresAt = expiresAt;
        this.usedAt = usedAt || null;
        this.createdBy = createdBy;
        this.createdAt = createdAt || new Date().toISOString();
    }

    toJSON() {
        return {
            id: this.id,
            token: this.token,
            role: this.role,
            expiresAt: this.expiresAt,
            usedAt: this.usedAt,
            createdBy: this.createdBy,
            createdAt: this.createdAt,
        };
    }

    static normalize(row) {
        if (!row) return null;

        const expiresAtRaw = row.expiresAt || row.expires_at;
        const usedAtRaw = row.usedAt || row.used_at;
        const createdAtRaw = row.createdAt || row.created_at;

        return {
            id: row.id,
            token: row.token,
            role: String(row.role || 'member').toLowerCase(),
            expiresAt: expiresAtRaw ? new Date(expiresAtRaw).toISOString() : undefined,
            usedAt: usedAtRaw ? new Date(usedAtRaw).toISOString() : null,
            createdBy: row.createdBy || row.created_by,
            createdAt: createdAtRaw ? new Date(createdAtRaw).toISOString() : undefined,
        };
    }

    static serialize(payload = {}) {
        if (payload instanceof Invite) {
            const invite = payload.toJSON();
            return {
                id: invite.id,
                token: invite.token,
                role: String(invite.role || 'member').toLowerCase(),
                expires_at: this.driver.toDateTime(invite.expiresAt),
                used_at: invite.usedAt ? this.driver.toDateTime(invite.usedAt) : null,
                created_by: invite.createdBy,
                created_at: this.driver.toDateTime(invite.createdAt || Date.now()),
            };
        }

        const serialized = {};

        if (payload.id !== undefined) serialized.id = payload.id;
        if (payload.token !== undefined) serialized.token = payload.token;
        if (payload.role !== undefined) serialized.role = String(payload.role || 'member').toLowerCase();
        if (payload.expiresAt !== undefined) serialized.expires_at = this.driver.toDateTime(payload.expiresAt);
        if (payload.usedAt !== undefined) {
            serialized.used_at = payload.usedAt ? this.driver.toDateTime(payload.usedAt) : null;
        }
        if (payload.createdBy !== undefined) serialized.created_by = payload.createdBy;
        if (payload.createdAt !== undefined) serialized.created_at = this.driver.toDateTime(payload.createdAt);

        return serialized;
    }

    static async create(payload) {
        const invite = payload instanceof Invite ? payload.toJSON() : new Invite(payload).toJSON();
        const serialized = await this.insert(invite);
        return this.get(serialized.id);
    }

    static async findByToken(token) {
        if (!token) return null;
        return this.get({ token });
    }

    static async markAsUsed(id) {
        if (!id) return;
        await this.driver.update(
            this.table,
            { used_at: this.driver.toDateTime(Date.now()) },
            id,
        );
    }

    static isExpired(invite) {
        if (!invite?.expiresAt) return true;
        return Date.now() > new Date(invite.expiresAt).getTime();
    }

    static isUsed(invite) {
        return Boolean(invite?.usedAt);
    }
}
