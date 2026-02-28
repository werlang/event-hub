import { User } from '../model/user.js';
import { Event } from '../model/event.js';
import { Mysql } from './mysql.js';

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

    #driver;
    #ready;

    constructor(driver = Mysql) {
        this.#driver = driver;
        this.#ready = this.#bootstrap();
    }

    async #bootstrap() {
        await this.#driver.connect();

        await this.#driver.query(`
            CREATE TABLE IF NOT EXISTS users (
                id CHAR(36) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                salt VARCHAR(64) NOT NULL,
                password_hash VARCHAR(128) NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `, []);

        await this.#driver.query(`
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
        `, []);

        await this.#seedDefaults();
    }

    async #seedDefaults() {
        const seeds = defaultData();
        const users = await User.find({
            view: ['id'],
            opt: { limit: 1 },
        });

        if (users.length > 0) {
            return;
        }

        const admin = seeds.users[0];
        await User.create(admin);

        for (const event of seeds.events) {
            await Event.create(event);
        }
    }

    async ready() {
        await this.#ready;
    }

    async listUsers() {
        await this.ready();
        return User.list();
    }

    async findUserByEmail(email) {
        if (!email) return null;
        await this.ready();
        return User.findByEmail(email);
    }

    async findUserById(id) {
        if (!id) return null;
        await this.ready();
        return User.findById(id);
    }

    async addUser(user) {
        await this.ready();
        return User.create(user);
    }

    async listEvents(filters = {}) {
        await this.ready();
        return Event.list(filters);
    }

    async findEventById(id) {
        await this.ready();
        return Event.findById(id);
    }

    async addEvent(event) {
        await this.ready();
        return Event.create(event);
    }

    async deleteEvent(id) {
        await this.ready();
        await Event.delete(id);
    }
}
