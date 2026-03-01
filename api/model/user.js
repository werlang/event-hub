import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Model } from './model.js';

export class User extends Model {

    static table = 'users';
    static view = ['id', 'name', 'email', 'role', 'password_hash', 'created_at'];
    static BCRYPT_ROUNDS = 12;
    static ALLOWED_ROLES = ['admin', 'member'];

    #passwordHash;

    constructor({ id, name, email, role, password, passwordHash } = {}) {
        super();
        this.id = id || crypto.randomUUID();
        this.name = name || '';
        this.email = email?.toLowerCase() || '';
        this.role = User.normalizeRole(role);
        this.#passwordHash = passwordHash || this.#hashPassword(password || '');
    }

    static normalizeRole(role) {
        const normalizedRole = String(role || 'member').toLowerCase();
        return User.ALLOWED_ROLES.includes(normalizedRole) ? normalizedRole : 'member';
    }

    #hashPassword(plain) {
        return bcrypt.hashSync(plain, User.BCRYPT_ROUNDS);
    }

    validatePassword(plain) {
        if (!this.#passwordHash) {
            return false;
        }

        return bcrypt.compareSync(plain || '', this.#passwordHash);
    }

    get passwordHash() {
        return this.#passwordHash;
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            email: this.email,
            role: this.role,
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
            role: User.normalizeRole(row.role),
            passwordHash: row.passwordHash || row.password_hash,
            createdAt: createdAtRaw ? new Date(createdAtRaw).toISOString() : undefined,
        };
    }

    static serialize(payload = {}) {
        const isHydratedUser = payload instanceof User;
        const hasHashedCredentials = Boolean(payload.passwordHash);
        const user = isHydratedUser
            ? payload
            : (hasHashedCredentials ? payload : new User(payload));

        const json = user instanceof User ? user.toJSON() : user;

        return {
            id: json.id,
            name: json.name,
            email: json.email?.toLowerCase(),
            role: User.normalizeRole(json.role),
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
