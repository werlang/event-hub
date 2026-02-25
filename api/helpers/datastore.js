import mysql from 'mysql2/promise';
import { User } from '../model/user.js';
import { Event } from '../model/event.js';

const configFromEnv = () => ({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'academic_events',
    port: Number(process.env.DB_PORT || 3306),
});

const defaultData = () => {
    const admin = new User({
        name: 'Coordenador',
        email: 'admin@universidade.test',
        password: 'changeme',
    });

    const kickoff = new Event({
        title: 'Semana de Integração Acadêmica',
        description: 'Palestras, oficinas e mentorias para novos estudantes.',
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        category: 'Comunidade',
        location: 'Auditório Central',
        audience: ['calouros', 'professores'],
        organizerId: admin.id,
    });

    const research = new Event({
        title: 'Mostra de Iniciação Científica',
        description: 'Apresentação de projetos e pôsteres com curadoria dos programas de pesquisa.',
        date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
        category: 'Pesquisa',
        location: 'Bloco B - Salas 201/202',
        audience: ['pós-graduação', 'pesquisa'],
        organizerId: admin.id,
    });

    return {
        users: [admin.toJSON()],
        events: [kickoff.toJSON(), research.toJSON()],
    };
};

export class DataStore {

    #pool;
    #ready;

    constructor(pool) {
        this.#pool = pool || mysql.createPool({
            ...configFromEnv(),
            waitForConnections: true,
            connectionLimit: 10,
            namedPlaceholders: true,
        });
        this.#ready = this.#bootstrap();
    }

    async #bootstrap() {
        await this.#pool.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id CHAR(36) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                salt VARCHAR(64) NOT NULL,
                password_hash VARCHAR(128) NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);

        await this.#pool.execute(`
            CREATE TABLE IF NOT EXISTS events (
                id CHAR(36) PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                date DATETIME NOT NULL,
                category VARCHAR(64) DEFAULT 'Geral',
                location VARCHAR(255) DEFAULT 'A definir',
                audience JSON NULL,
                organizer_id CHAR(36) NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);

        await this.#seedDefaults();
    }

    async #seedDefaults() {
        const seeds = defaultData();
        const [usersCount] = await this.#pool.query('SELECT COUNT(*) as count FROM users');
        if (usersCount?.[0]?.count > 0) {
            return;
        }

        const admin = seeds.users[0];
        await this.#pool.execute(
            'INSERT INTO users (id, name, email, salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [admin.id, admin.name, admin.email, admin.salt, admin.passwordHash, new Date()]
        );

        for (const event of seeds.events) {
            await this.#pool.execute(
                `INSERT INTO events (id, title, description, date, category, location, audience, organizer_id, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    event.id,
                    event.title,
                    event.description,
                    new Date(event.date),
                    event.category,
                    event.location,
                    JSON.stringify(event.audience || []),
                    event.organizerId,
                    new Date(event.createdAt || Date.now()),
                ],
            );
        }
    }

    async ready() {
        await this.#ready;
    }

    #normalizeUser(row) {
        if (!row) return null;
        return {
            id: row.id,
            name: row.name,
            email: row.email,
            salt: row.salt,
            passwordHash: row.passwordHash || row.password_hash,
            createdAt: row.createdAt || row.created_at ? new Date(row.createdAt || row.created_at).toISOString() : undefined,
        };
    }

    #normalizeEvent(row) {
        if (!row) return null;
        const toIso = (value) => value ? new Date(value).toISOString() : value;
        return {
            id: row.id,
            title: row.title,
            description: row.description,
            date: toIso(row.date),
            category: row.category,
            location: row.location,
            audience: this.#parseAudience(row.audience),
            organizerId: row.organizerId || row.organizer_id,
            createdAt: toIso(row.createdAt || row.created_at),
        };
    }

    #parseAudience(raw) {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'object') return Object.values(raw);
        try {
            return JSON.parse(raw);
        } catch (err) {
            return [];
        }
    }

    async listUsers() {
        await this.ready();
        const [rows] = await this.#pool.query(`
            SELECT id, name, email, salt, password_hash as passwordHash, created_at as createdAt
            FROM users
        `);
        return rows.map(row => this.#normalizeUser(row));
    }

    async findUserByEmail(email) {
        if (!email) return null;
        await this.ready();
        const [rows] = await this.#pool.query(`
            SELECT id, name, email, salt, password_hash as passwordHash, created_at as createdAt
            FROM users
            WHERE email = ?
            LIMIT 1
        `, [email.toLowerCase()]);
        return this.#normalizeUser(rows[0]);
    }

    async findUserById(id) {
        if (!id) return null;
        await this.ready();
        const [rows] = await this.#pool.query(`
            SELECT id, name, email, salt, password_hash as passwordHash, created_at as createdAt
            FROM users
            WHERE id = ?
            LIMIT 1
        `, [id]);
        return this.#normalizeUser(rows[0]);
    }

    async addUser(user) {
        await this.ready();
        const payload = new User(user).toJSON();
        await this.#pool.execute(
            'INSERT INTO users (id, name, email, salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [payload.id, payload.name, payload.email, payload.salt, payload.passwordHash, new Date()]
        );
        return payload;
    }

    async listEvents(filters = {}) {
        await this.ready();
        const { search, category, from, to, audience } = filters;
        const conditions = [];
        const values = [];

        if (category) {
            conditions.push('LOWER(category) = ?');
            values.push(category.toLowerCase());
        }
        if (from) {
            conditions.push('date >= ?');
            values.push(new Date(from));
        }
        if (to) {
            conditions.push('date <= ?');
            values.push(new Date(to));
        }
        if (audience) {
            conditions.push('audience IS NOT NULL AND LOWER(JSON_UNQUOTE(JSON_EXTRACT(audience, "$"))) LIKE ?');
            values.push(`%${audience.toLowerCase()}%`);
        }
        if (search) {
            const pattern = `%${search.toLowerCase()}%`;
            conditions.push('(LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(location) LIKE ? OR LOWER(category) LIKE ?)');
            values.push(pattern, pattern, pattern, pattern);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const [rows] = await this.#pool.query(`
            SELECT
                id,
                title,
                description,
                date,
                category,
                location,
                audience,
                organizer_id,
                created_at
            FROM events
            ${whereClause}
            ORDER BY date ASC
        `, values);

        return rows.map(row => this.#normalizeEvent(row));
    }

    async findEventById(id) {
        await this.ready();
        const [rows] = await this.#pool.query(`
            SELECT
                id,
                title,
                description,
                date,
                category,
                location,
                audience,
                organizer_id,
                created_at
            FROM events
            WHERE id = ?
            LIMIT 1
        `, [id]);
        return this.#normalizeEvent(rows[0]);
    }

    async addEvent(event) {
        await this.ready();
        const payload = new Event(event).toJSON();
        await this.#pool.execute(
            `INSERT INTO events (id, title, description, date, category, location, audience, organizer_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                payload.id,
                payload.title,
                payload.description,
                new Date(payload.date),
                payload.category,
                payload.location,
                JSON.stringify(payload.audience || []),
                payload.organizerId,
                new Date(payload.createdAt || Date.now()),
            ],
        );
        return payload;
    }

    async deleteEvent(id) {
        await this.ready();
        await this.#pool.execute('DELETE FROM events WHERE id = ?', [id]);
    }
}
