import crypto from 'crypto';
import { Model } from './model.js';

export class User extends Model {

    static table = 'users';
    static view = ['id', 'name', 'email', 'salt', 'password_hash', 'created_at'];

    #passwordHash;
    #salt;

    constructor({ id, name, email, password, salt, passwordHash } = {}) {
        super();
        this.id = id || crypto.randomUUID();
        this.name = name || '';
        this.email = email?.toLowerCase() || '';
        this.#salt = salt || crypto.randomBytes(16).toString('hex');
        this.#passwordHash = passwordHash || this.#hashPassword(password || '');
    }

    #hashPassword(plain) {
        return crypto.pbkdf2Sync(plain, this.#salt, 310000, 32, 'sha256').toString('hex');
    }

    validatePassword(plain) {
        const hash = this.#hashPassword(plain || '');
        return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(this.#passwordHash, 'hex'));
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            email: this.email,
            salt: this.#salt,
            passwordHash: this.#passwordHash,
        };
    }

    static normalize(row) {
        if (!row) return null;

        const createdAtRaw = row.createdAt || row.created_at;
        return {
            id: row.id,
            name: row.name,
            email: row.email,
            salt: row.salt,
            passwordHash: row.passwordHash || row.password_hash,
            createdAt: createdAtRaw ? new Date(createdAtRaw).toISOString() : undefined,
        };
    }

    static serialize(payload = {}) {
        const isHydratedUser = payload instanceof User;
        const hasHashedCredentials = payload.passwordHash && payload.salt;
        const user = isHydratedUser
            ? payload
            : (hasHashedCredentials ? payload : new User(payload));

        const json = user instanceof User ? user.toJSON() : user;

        return {
            id: json.id,
            name: json.name,
            email: json.email?.toLowerCase(),
            salt: json.salt,
            password_hash: json.passwordHash,
            created_at: this.driver.toDateTime(payload.createdAt || Date.now()),
        };
    }

    static async list() {
        return this.find();
    }

    static async findByEmail(email) {
        if (!email) return null;
        return this.get({ email: email.toLowerCase() });
    }

    static async findById(id) {
        if (!id) return null;
        return this.get(id);
    }

    static async create(payload) {
        const serialized = await this.insert(payload);
        return this.get(serialized.id);
    }
}
