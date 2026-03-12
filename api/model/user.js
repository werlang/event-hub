import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Model } from './model.js';

export class User extends Model {

    static table = 'users';
    static view = ['id', 'name', 'email', 'role', 'password_hash', 'created_at'];
    static BCRYPT_ROUNDS = 12;
    static ALLOWED_ROLES = ['admin', 'member'];

    #passwordHash;

    /**
     * Creates a user entity with normalized credentials and role data.
     */
    constructor({ id, name, email, role, password, passwordHash } = {}) {
        super();
        this.id = id || crypto.randomUUID();
        this.name = name || '';
        this.email = email?.toLowerCase() || '';
        this.role = User.normalizeRole(role);
        this.#passwordHash = passwordHash || this.#hashPassword(password || '');
    }

    /**
     * Normalizes the role stored for a user.
     */
    static normalizeRole(role) {
        const normalizedRole = String(role || 'member').toLowerCase();
        return User.ALLOWED_ROLES.includes(normalizedRole) ? normalizedRole : 'member';
    }

    /**
     * Hashes a plain-text password using the configured bcrypt rounds.
     */
    #hashPassword(plain) {
        return bcrypt.hashSync(plain, User.BCRYPT_ROUNDS);
    }

    /**
     * Checks whether a plain-text password matches the stored hash.
     */
    validatePassword(plain) {
        if (!this.#passwordHash) {
            return false;
        }

        return bcrypt.compareSync(plain || '', this.#passwordHash);
    }

    /**
     * Exposes the stored password hash for serialization.
     */
    get passwordHash() {
        return this.#passwordHash;
    }

    /**
     * Returns the serializable entity snapshot for the user.
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            email: this.email,
            role: this.role,
            passwordHash: this.#passwordHash,
        };
    }

    /**
     * Normalizes a raw database row into the public user shape.
     */
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

    /**
     * Serializes a user payload into the database column format.
     */
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

    /**
     * Lists every persisted user.
     */
    static async list() {
        return this.find();
    }

    /**
     * Retrieves a user by normalized email.
     */
    static async findByEmail(email) {
        if (!email) return null;
        return this.get({ email: email.toLowerCase() });
    }

    /**
     * Retrieves a user by id.
     */
    static async findById(id) {
        if (!id) return null;
        return this.get(id);
    }

    /**
     * Creates and returns a new persisted user.
     */
    static async create(payload) {
        const serialized = await this.insert(payload);
        return this.get(serialized.id);
    }
}
