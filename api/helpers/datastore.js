import { promises as fs } from 'fs';
import { dirname } from 'path';
import { User } from '../model/user.js';
import { Event } from '../model/event.js';

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

    #filePath;
    #data;
    #ready;

    constructor(filePath = new URL('../data/database.json', import.meta.url).pathname) {
        this.#filePath = filePath;
        this.#ready = this.#bootstrap();
    }

    async #bootstrap() {
        const dir = dirname(this.#filePath);
        await fs.mkdir(dir, { recursive: true });
        try {
            const contents = await fs.readFile(this.#filePath, 'utf-8');
            this.#data = JSON.parse(contents);
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
            this.#data = defaultData();
            await this.#persist();
        }
    }

    async #persist() {
        await fs.writeFile(this.#filePath, JSON.stringify(this.#data, null, 2));
    }

    async ready() {
        await this.#ready;
    }

    async listUsers() {
        await this.ready();
        return this.#data.users.map(u => ({ ...u }));
    }

    async findUserByEmail(email) {
        if (!email) return null;
        await this.ready();
        return this.#data.users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
    }

    async findUserById(id) {
        if (!id) return null;
        await this.ready();
        return this.#data.users.find(u => u.id === id) || null;
    }

    async addUser(user) {
        await this.ready();
        this.#data.users.push(user);
        await this.#persist();
        return user;
    }

    async listEvents(filters = {}) {
        await this.ready();
        const { search, category, from, to, audience } = filters;
        return this.#data.events
            .filter(event => {
                if (category && event.category?.toLowerCase() !== category.toLowerCase()) return false;
                if (from && new Date(event.date) < new Date(from)) return false;
                if (to && new Date(event.date) > new Date(to)) return false;
                if (audience && !event.audience?.some(tag => tag.toLowerCase().includes(audience.toLowerCase()))) return false;
                if (search) {
                    const hay = [event.title, event.description, event.location, event.category].join(' ').toLowerCase();
                    if (!hay.includes(search.toLowerCase())) return false;
                }
                return true;
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map(ev => ({ ...ev }));
    }

    async findEventById(id) {
        await this.ready();
        return this.#data.events.find(ev => ev.id === id) || null;
    }

    async addEvent(event) {
        await this.ready();
        this.#data.events.push(event);
        await this.#persist();
        return event;
    }

    async deleteEvent(id) {
        await this.ready();
        const before = this.#data.events.length;
        this.#data.events = this.#data.events.filter(ev => ev.id !== id);
        if (this.#data.events.length !== before) {
            await this.#persist();
        }
    }
}
