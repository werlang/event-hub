import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Model } from './model.js';

const EMAIL_PREFERENCE_KEYS = Object.freeze({
    weeklyDigest: 'weeklyDigest',
    eventUpdates: 'eventUpdates',
    adminPendingRequests: 'adminPendingRequests',
});

const EMAIL_PREFERENCE_COLUMNS = Object.freeze({
    [EMAIL_PREFERENCE_KEYS.weeklyDigest]: 'email_weekly_enabled',
    [EMAIL_PREFERENCE_KEYS.eventUpdates]: 'email_event_updates_enabled',
    [EMAIL_PREFERENCE_KEYS.adminPendingRequests]: 'email_admin_pending_requests_enabled',
});

const DEFAULT_EMAIL_PREFERENCES = Object.freeze({
    [EMAIL_PREFERENCE_KEYS.weeklyDigest]: true,
    [EMAIL_PREFERENCE_KEYS.eventUpdates]: true,
    [EMAIL_PREFERENCE_KEYS.adminPendingRequests]: true,
});

export class User extends Model {

    static table = 'users';
    static EMAIL_PREFERENCE_KEYS = EMAIL_PREFERENCE_KEYS;
    static EMAIL_PREFERENCE_COLUMNS = EMAIL_PREFERENCE_COLUMNS;
    static view = ['id', 'name', 'email', 'role', 'password_hash', 'created_at', ...Object.values(EMAIL_PREFERENCE_COLUMNS)];
    static SAFE_VIEW = ['id', 'name', 'email', 'role', 'created_at', ...Object.values(EMAIL_PREFERENCE_COLUMNS)];
    static BCRYPT_ROUNDS = 12;
    static ALLOWED_ROLES = ['admin', 'member'];

    #passwordHash;

    /**
     * Creates a user entity with normalized credentials and role data.
     */
    constructor({ id, name, email, role, password, passwordHash, emailPreferences } = {}) {
        super();
        this.id = id || crypto.randomUUID();
        this.name = User.normalizeName(name);
        this.email = User.normalizeEmail(email);
        this.role = User.normalizeRole(role);
        this.emailPreferences = User.normalizeEmailPreferences(emailPreferences);
        this.#passwordHash = passwordHash || User.hashPassword(password.toString().trim());
    }

    /**
     * Normalizes a stored or user-provided display name.
     */
    static normalizeName(name) {
        return typeof name === 'string' ? name.trim() : '';
    }

    /**
     * Normalizes an e-mail address for persistence and lookup.
     */
    static normalizeEmail(email) {
        return typeof email === 'string' ? email.trim().toLowerCase() : '';
    }

    /**
     * Normalizes the role stored for a user.
     */
    static normalizeRole(role) {
        const normalizedRole = String(role || 'member').toLowerCase();
        return User.ALLOWED_ROLES.includes(normalizedRole) ? normalizedRole : 'member';
    }

    /**
     * Normalizes one stored e-mail preference flag into a boolean value.
     */
    static normalizeEmailPreferenceValue(value, fallback = true) {
        if (value === undefined || value === null) {
            return fallback;
        }

        if (typeof value === 'boolean') {
            return value;
        }

        if (typeof value === 'number') {
            return value !== 0;
        }

        const normalizedValue = String(value).trim().toLowerCase();

        if (['1', 'true', 'on', 'yes'].includes(normalizedValue)) {
            return true;
        }

        if (['0', 'false', 'off', 'no'].includes(normalizedValue)) {
            return false;
        }

        return fallback;
    }

    /**
     * Normalizes the full e-mail preference snapshot exposed by the API.
     */
    static normalizeEmailPreferences(preferences = {}) {
        const source = preferences && typeof preferences === 'object'
            ? preferences
            : {};

        return {
            [EMAIL_PREFERENCE_KEYS.weeklyDigest]: this.normalizeEmailPreferenceValue(
                source[EMAIL_PREFERENCE_KEYS.weeklyDigest] ?? source[EMAIL_PREFERENCE_COLUMNS[EMAIL_PREFERENCE_KEYS.weeklyDigest]],
                DEFAULT_EMAIL_PREFERENCES[EMAIL_PREFERENCE_KEYS.weeklyDigest],
            ),
            [EMAIL_PREFERENCE_KEYS.eventUpdates]: this.normalizeEmailPreferenceValue(
                source[EMAIL_PREFERENCE_KEYS.eventUpdates] ?? source[EMAIL_PREFERENCE_COLUMNS[EMAIL_PREFERENCE_KEYS.eventUpdates]],
                DEFAULT_EMAIL_PREFERENCES[EMAIL_PREFERENCE_KEYS.eventUpdates],
            ),
            [EMAIL_PREFERENCE_KEYS.adminPendingRequests]: this.normalizeEmailPreferenceValue(
                source[EMAIL_PREFERENCE_KEYS.adminPendingRequests] ?? source[EMAIL_PREFERENCE_COLUMNS[EMAIL_PREFERENCE_KEYS.adminPendingRequests]],
                DEFAULT_EMAIL_PREFERENCES[EMAIL_PREFERENCE_KEYS.adminPendingRequests],
            ),
        };
    }

    /**
     * Resolves the storage column for one supported e-mail preference key.
     */
    static readEmailPreferenceColumn(preferenceKey) {
        const normalizedKey = String(preferenceKey || '').trim();
        const column = EMAIL_PREFERENCE_COLUMNS[normalizedKey];

        if (!column) {
            throw new TypeError(`Unsupported email preference key: ${normalizedKey}`);
        }

        return column;
    }

    /**
     * Serializes the e-mail preference flags into database column names.
     */
    static serializeEmailPreferences(preferences = {}) {
        const normalized = this.normalizeEmailPreferences(preferences);

        return {
            [EMAIL_PREFERENCE_COLUMNS[EMAIL_PREFERENCE_KEYS.weeklyDigest]]: normalized[EMAIL_PREFERENCE_KEYS.weeklyDigest],
            [EMAIL_PREFERENCE_COLUMNS[EMAIL_PREFERENCE_KEYS.eventUpdates]]: normalized[EMAIL_PREFERENCE_KEYS.eventUpdates],
            [EMAIL_PREFERENCE_COLUMNS[EMAIL_PREFERENCE_KEYS.adminPendingRequests]]: normalized[EMAIL_PREFERENCE_KEYS.adminPendingRequests],
        };
    }

    /**
     * Reports whether one user snapshot allows a specific e-mail category.
     */
    static allowsEmailPreference(user, preferenceKey) {
        const normalizedKey = String(preferenceKey || '').trim();

        if (!Object.hasOwn(EMAIL_PREFERENCE_COLUMNS, normalizedKey)) {
            throw new TypeError(`Unsupported email preference key: ${normalizedKey}`);
        }

        const normalizedPreferences = this.normalizeEmailPreferences(user?.emailPreferences || user);
        return normalizedPreferences[normalizedKey];
    }

    /**
     * Hashes a plain-text password using the configured bcrypt rounds.
     */
    static hashPassword(plain) {
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
            emailPreferences: this.emailPreferences,
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
            emailPreferences: User.normalizeEmailPreferences(row.emailPreferences || row),
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
            name: this.normalizeName(json.name),
            email: this.normalizeEmail(json.email),
            role: User.normalizeRole(json.role),
            password_hash: json.passwordHash,
            ...this.serializeEmailPreferences(json.emailPreferences),
            created_at: this.driver.toDateTime(payload.createdAt || Date.now()),
        };
    }

    /**
     * Lists persisted users using a safe projection for administrative tooling.
     */
    static async list({ role, excludeId, view = this.SAFE_VIEW } = {}) {
        const filter = {};

        if (role) {
            filter.role = this.normalizeRole(role);
        }

        if (excludeId) {
            filter.id = { not: excludeId };
        }

        return this.find({
            filter,
            view,
            opt: { order: { name: 1 } },
        });
    }

    /**
     * Lists users visible to administrators while excluding the current actor.
     */
    static async listForAdministration({ excludeId } = {}) {
        return this.list({ excludeId });
    }

    /**
     * Lists users who opted in to one supported e-mail category.
     */
    static async listEmailPreferenceRecipients(preferenceKey, { role, excludeId, view = this.SAFE_VIEW } = {}) {
        const filter = {
            [this.readEmailPreferenceColumn(preferenceKey)]: true,
        };

        if (role) {
            filter.role = this.normalizeRole(role);
        }

        if (excludeId) {
            filter.id = { not: excludeId };
        }

        return this.find({
            filter,
            view,
            opt: { order: { name: 1 } },
        });
    }

    /**
     * Retrieves a user by normalized email.
     */
    static async findByEmail(email) {
        const normalizedEmail = this.normalizeEmail(email);
        if (!normalizedEmail) return null;
        return this.get({ email: normalizedEmail });
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

    /**
     * Updates the stored password hash for a persisted user.
     */
    static async updatePassword(id, password) {
        if (!id) {
            return null;
        }

        await this.driver.update(this.table, {
            password_hash: this.hashPassword(password || ''),
        }, id);

        return this.get(id);
    }

    /**
     * Updates the persisted display name and e-mail for a user.
     */
    static async updateProfile(id, { name, email } = {}) {
        if (!id) {
            return null;
        }

        await this.driver.update(this.table, {
            name: this.normalizeName(name),
            email: this.normalizeEmail(email),
        }, id);

        return this.get(id);
    }

    /**
     * Updates the persisted e-mail preference flags for one user.
     */
    static async updateEmailPreferences(id, emailPreferences = {}) {
        if (!id) {
            return null;
        }

        await this.driver.update(this.table, this.serializeEmailPreferences(emailPreferences), id);

        return this.get(id);
    }

    /**
     * Updates the persisted role for a user and returns the refreshed entity.
     */
    static async updateRole(id, role) {
        if (!id) {
            return null;
        }

        await this.driver.update(this.table, {
            role: this.normalizeRole(role),
        }, id);

        return this.get(id);
    }

    /**
     * Promotes a persisted member account to administrator.
     */
    static async promoteToAdmin(id) {
        return this.updateRole(id, 'admin');
    }
}
