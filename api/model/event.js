import crypto from 'crypto';

export class Event {

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
}
