import crypto from 'crypto';
import { Model } from './model.js';

export class Event extends Model {

    static table = 'events';
    static view = [
        'id',
        'title',
        'description',
        'date',
        'category',
        'location',
        'audience',
        'organizer_id',
        'created_at',
    ];

    constructor({
        id,
        title,
        description,
        date,
        category,
        location,
        audience = [],
        organizerId,
        createdAt,
    } = {}) {
        super();
        this.id = id || crypto.randomUUID();
        this.title = title || '';
        this.description = description || '';
        this.date = date;
        this.category = category || 'Geral';
        this.location = location || 'A definir';
        this.audience = audience;
        this.organizerId = organizerId;
        this.createdAt = createdAt || new Date().toISOString();
    }

    toJSON() {
        return {
            id: this.id,
            title: this.title,
            description: this.description,
            date: this.date,
            category: this.category,
            location: this.location,
            audience: this.audience,
            organizerId: this.organizerId,
            createdAt: this.createdAt,
        };
    }

    static #parseAudience(raw) {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'object') return Object.values(raw);

        try {
            return JSON.parse(raw);
        } catch (error) {
            return [];
        }
    }

    static normalize(row) {
        if (!row) return null;

        return {
            id: row.id,
            title: row.title,
            description: row.description,
            date: row.date ? new Date(row.date).toISOString() : row.date,
            category: row.category,
            location: row.location,
            audience: this.#parseAudience(row.audience),
            organizerId: row.organizerId || row.organizer_id,
            createdAt: row.createdAt || row.created_at
                ? new Date(row.createdAt || row.created_at).toISOString()
                : undefined,
        };
    }

    static serialize(payload = {}) {
        const event = payload instanceof Event ? payload.toJSON() : new Event(payload).toJSON();
        return {
            id: event.id,
            title: event.title,
            description: event.description,
            date: this.driver.toDateTime(event.date),
            category: event.category,
            location: event.location,
            audience: JSON.stringify(event.audience || []),
            organizer_id: event.organizerId,
            created_at: this.driver.toDateTime(event.createdAt || Date.now()),
        };
    }

    static async findById(id) {
        if (!id) return null;
        return this.get(id);
    }

    static async create(payload) {
        const serialized = await this.insert(payload);
        return this.get(serialized.id);
    }

    static async list(filters = {}) {
        const { search, category, from, to, audience } = filters;
        const queryFilter = {};

        if (from && to) {
            queryFilter.date = this.driver.between(
                this.driver.toDateTime(from),
                this.driver.toDateTime(to),
            );
        } else if (from) {
            queryFilter.date = this.driver.gte(this.driver.toDateTime(from));
        } else if (to) {
            queryFilter.date = this.driver.lte(this.driver.toDateTime(to));
        }

        if (audience) {
            queryFilter.audience = this.driver.like(audience);
        }

        const rows = await this.find({
            filter: queryFilter,
            opt: { order: { date: 1 } },
        });

        const normalizedCategory = category?.toLowerCase();
        const normalizedSearch = search?.toLowerCase();
        const normalizedAudience = audience?.toLowerCase();

        return rows.filter(event => {
            if (normalizedCategory && (event.category || '').toLowerCase() !== normalizedCategory) {
                return false;
            }

            if (normalizedAudience) {
                const matchedAudience = (event.audience || []).some(value => value.toLowerCase().includes(normalizedAudience));
                if (!matchedAudience) {
                    return false;
                }
            }

            if (!normalizedSearch) {
                return true;
            }

            return [event.title, event.description, event.location, event.category]
                .filter(Boolean)
                .some(value => value.toLowerCase().includes(normalizedSearch));
        });
    }
}
