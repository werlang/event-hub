import crypto from 'crypto';
import { Model } from './model.js';
import { normalizeEventCategoryId, readEventCategoryLabel } from '../helpers/event-category.js';

export class Event extends Model {

    static table = 'events';
    static view = [
        'id',
        'title',
        'description',
        'date',
        'category',
        'location',
        'status',
        'organizer_id',
        'created_at',
    ];
    static STATUS_PENDING = 'pending';
    static STATUS_PUBLISHED = 'published';
    static STATUS_REJECTED = 'rejected';
    static ALLOWED_STATUSES = ['pending', 'published', 'rejected'];

    static #schemaReady = false;
    static #schemaPromise = null;

    /**
     * Creates an event entity with the project's default values.
     */
    constructor({
        id,
        title,
        description,
        date,
        category,
        location,
        status,
        organizerId,
        createdAt,
    } = {}) {
        super();
        this.id = id || crypto.randomUUID();
        this.title = title || '';
        this.description = description || '';
        this.date = date;
        this.category = normalizeEventCategoryId(category, { fallback: 'outro' });
        this.location = location || 'A definir';
        this.status = Event.normalizeStatus(status);
        this.organizerId = organizerId;
        this.createdAt = createdAt || new Date().toISOString();
    }

    /**
     * Returns the serializable entity snapshot for the event.
     */
    toJSON() {
        return {
            id: this.id,
            title: this.title,
            description: this.description,
            date: this.date,
            category: this.category,
            categoryLabel: readEventCategoryLabel(this.category, { fallback: 'Outro' }),
            location: this.location,
            status: this.status,
            organizerId: this.organizerId,
            createdAt: this.createdAt,
        };
    }

    /**
     * Normalizes the persisted moderation status.
     */
    static normalizeStatus(status) {
        const normalizedStatus = String(status || Event.STATUS_PENDING).trim().toLowerCase();
        return Event.ALLOWED_STATUSES.includes(normalizedStatus)
            ? normalizedStatus
            : Event.STATUS_PENDING;
    }

    /**
     * Checks whether a moderation status represents a public event.
     */
    static isPublishedStatus(status) {
        return Event.normalizeStatus(status) === Event.STATUS_PUBLISHED;
    }

    /**
     * Checks whether an owner may still edit or delete an event.
     */
    static canOwnerManageStatus(status) {
        const normalizedStatus = Event.normalizeStatus(status);
        return [Event.STATUS_PENDING, Event.STATUS_REJECTED].includes(normalizedStatus);
    }

    /**
     * Ensures the moderation column exists before event queries run.
     */
    static async ensureSchema() {
        if (Event.#schemaReady) {
            return;
        }

        if (!Event.#schemaPromise) {
            Event.#schemaPromise = Event.#ensureStatusColumn();
        }

        try {
            await Event.#schemaPromise;
            Event.#schemaReady = true;
        } catch (error) {
            Event.#schemaPromise = null;
            throw error;
        }
    }

    /**
     * Adds the moderation column for existing databases and preserves old public events.
     */
    static async #ensureStatusColumn() {
        const statusColumns = await this.driver.query(
            `SHOW COLUMNS FROM \`${this.table}\` LIKE 'status'`,
        );

        if (statusColumns.length > 0) {
            return;
        }

        await this.driver.query(
            `ALTER TABLE \`${this.table}\` ADD COLUMN \`status\` VARCHAR(32) NOT NULL DEFAULT '${this.STATUS_PENDING}' AFTER \`location\``,
        );

        await this.driver.query(
            `UPDATE \`${this.table}\` SET \`status\` = ?`,
            [this.STATUS_PUBLISHED],
        );
    }

    /**
     * Normalizes a raw database row into the public event shape.
     */
    static normalize(row) {
        if (!row) return null;

        return {
            id: row.id,
            title: row.title,
            description: row.description,
            date: row.date ? new Date(row.date).toISOString() : row.date,
            category: normalizeEventCategoryId(row.category, { fallback: 'outro' }),
            categoryLabel: readEventCategoryLabel(row.category, { fallback: 'Outro' }),
            location: row.location,
            status: Event.normalizeStatus(row.status),
            organizerId: row.organizerId || row.organizer_id,
            createdAt: row.createdAt || row.created_at
                ? new Date(row.createdAt || row.created_at).toISOString()
                : undefined,
        };
    }

    /**
     * Serializes an event payload into the database column format.
     */
    static serialize(payload = {}) {
        const event = payload instanceof Event ? payload.toJSON() : new Event(payload).toJSON();
        return {
            id: event.id,
            title: event.title,
            description: event.description,
            date: this.driver.toDateTime(event.date),
            category: normalizeEventCategoryId(event.category, { fallback: 'outro' }),
            location: event.location,
            status: this.normalizeStatus(event.status),
            organizer_id: event.organizerId,
            created_at: this.driver.toDateTime(event.createdAt || Date.now()),
        };
    }

    /**
     * Serializes editable event fields without overwriting immutable columns.
     */
    static serializeEditablePayload(payload = {}) {
        return Object.fromEntries(Object.entries({
            title: payload.title,
            description: payload.description,
            date: payload.date ? this.driver.toDateTime(payload.date) : undefined,
            category: payload.category ? normalizeEventCategoryId(payload.category, { fallback: 'outro' }) : undefined,
            location: payload.location,
            status: payload.status ? this.normalizeStatus(payload.status) : undefined,
        }).filter(([, value]) => value !== undefined));
    }

    /**
     * Retrieves multiple events after making sure the schema is ready.
     */
    static async find(options = {}) {
        await this.ensureSchema();
        return super.find(options);
    }

    /**
     * Retrieves a single event using the base model lookup.
     */
    static async get(clause, { view = this.view } = {}) {
        await this.ensureSchema();
        return super.get(clause, { view });
    }

    /**
     * Retrieves an event by id.
     */
    static async findById(id) {
        if (!id) return null;
        return this.get(id);
    }

    /**
     * Retrieves a public event by id.
     */
    static async findPublicById(id) {
        if (!id) return null;
        return this.get({ id, status: this.STATUS_PUBLISHED });
    }

    /**
     * Creates and returns a new persisted event.
     */
    static async create(payload) {
        await this.ensureSchema();
        const event = payload instanceof Event ? payload.toJSON() : new Event(payload).toJSON();
        const serialized = await this.insert(event);
        return this.get(serialized.id);
    }

    /**
     * Lists events filtered by period, category, and free-text search.
     */
    static async list(filters = {}) {
        const { search, category, from, to } = filters;
        const queryFilter = {
            status: this.STATUS_PUBLISHED,
        };

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

        const rows = await this.find({
            filter: queryFilter,
            opt: { order: { date: 1 } },
        });

        const normalizedCategory = normalizeEventCategoryId(category, { fallback: '' }).toLowerCase();
        const normalizedSearch = search?.toLowerCase();

        return rows.filter(event => {
            if (normalizedCategory && normalizeEventCategoryId(event.category, { fallback: '' }).toLowerCase() !== normalizedCategory) {
                return false;
            }

            if (!normalizedSearch) {
                return true;
            }

            return [event.title, event.description, event.location, event.categoryLabel, event.category]
                .filter(Boolean)
                .some(value => value.toLowerCase().includes(normalizedSearch));
        });
    }

    /**
     * Lists every event owned by a specific organizer ordered by event date descending.
     */
    static async listByOrganizer(organizerId) {
        if (!organizerId) {
            return [];
        }

        return this.find({
            filter: { organizer_id: organizerId },
            opt: { order: { date: 0 } },
        });
    }

    /**
     * Lists unpublished events from other organizers for moderation.
     */
    static async listForModeration({ moderatorId, status } = {}) {
        const filter = {
            status: status ? this.normalizeStatus(status) : { not: this.STATUS_PUBLISHED },
        };

        if (moderatorId) {
            filter.organizer_id = { not: moderatorId };
        }

        return this.find({
            filter,
            opt: { order: { date: 0 } },
        });
    }

    /**
     * Updates editable event fields and returns the persisted event.
     */
    static async updateDetails(id, payload = {}) {
        if (!id) {
            return null;
        }

        await this.ensureSchema();
        const serialized = this.serializeEditablePayload(payload);
        await this.driver.update(this.table, serialized, id);
        return this.get(id);
    }

    /**
     * Updates the moderation status for an event and returns the persisted event.
     */
    static async updateStatus(id, status) {
        if (!id) {
            return null;
        }

        await this.ensureSchema();
        await this.driver.update(this.table, {
            status: this.normalizeStatus(status),
        }, id);
        return this.get(id);
    }

    /**
     * Deletes an event by id.
     */
    static async remove(id) {
        if (!id) {
            return;
        }

        await this.ensureSchema();
        await super.delete(id, { limit: 1 });
    }
}
