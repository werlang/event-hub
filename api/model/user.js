import crypto from 'crypto';

export class User {

    #passwordHash;
    #salt;

    constructor({ id, name, email, password, salt, passwordHash } = {}) {
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
}
