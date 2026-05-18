import crypto from 'crypto';
import { Model } from './model.js';
import { Relation } from './relation.js';
import { User } from './user.js';
import { normalizeEventCategoryId, readEventCategoryLabel } from '../helpers/event-category.js';
import { getCurrentWeekRangeLocal } from '../helpers/week-range.js';

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
        'rejection_reason',
        'calendar_link',
        'calendar_event_id',
        'organizer_id',
        'created_at',
    ];
    static STATUS_PENDING = 'pending';
    static STATUS_PUBLISHED = 'published';
    static STATUS_REJECTED = 'rejected';
    static ALLOWED_STATUSES = ['pending', 'published', 'rejected'];

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
        rejectionReason,
        calendarLink,
        calendarEventId,
        organizerId,
        organizerName,
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
        this.rejectionReason = Event.normalizeRejectionReason(rejectionReason);
        this.calendarLink = Event.normalizeCalendarLink(calendarLink);
        this.calendarEventId = Event.normalizeCalendarEventId(calendarEventId);
        this.organizerId = organizerId;
        this.organizerName = typeof organizerName === 'string' ? organizerName.trim() || undefined : undefined;
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
            rejectionReason: this.rejectionReason,
            calendarLink: this.calendarLink,
            calendarEventId: this.calendarEventId,
            organizerId: this.organizerId,
            organizerName: this.organizerName,
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
     * Normalizes optional moderation feedback stored for rejected events.
     */
    static normalizeRejectionReason(reason) {
        const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
        return normalizedReason || null;
    }

    /**
     * Normalizes the stored Google Calendar link for one event.
     */
    static normalizeCalendarLink(link) {
        const normalizedLink = typeof link === 'string' ? link.trim() : '';
        return normalizedLink || null;
    }

    /**
     * Normalizes the stored Google Calendar event id used for later deletion.
     */
    static normalizeCalendarEventId(calendarEventId) {
        const normalizedCalendarEventId = typeof calendarEventId === 'string' ? calendarEventId.trim() : '';
        return normalizedCalendarEventId || null;
    }

    /**
     * Checks whether a moderation status represents a public event.
     */
    static isPublishedStatus(status) {
        return Event.normalizeStatus(status) === Event.STATUS_PUBLISHED;
    }

    /**
     * Checks whether a moderation status stays inside the pending moderation queue.
     */
    static isPendingLikeStatus(status) {
        const normalizedStatus = Event.normalizeStatus(status);
        return normalizedStatus === Event.STATUS_PENDING;
    }

    /**
     * Checks whether an owner may still edit an event.
     */
    static canOwnerEditStatus(status) {
        const normalizedStatus = Event.normalizeStatus(status);
        return [Event.STATUS_PENDING, Event.STATUS_REJECTED].includes(normalizedStatus);
    }

    /**
     * Checks whether an owner may still delete an event.
     */
    static canOwnerDeleteStatus(status) {
        const normalizedStatus = Event.normalizeStatus(status);
        return [Event.STATUS_PENDING, Event.STATUS_REJECTED].includes(normalizedStatus);
    }

    /**
     * Resolves the moderation-queue filter that should be used for one requested status.
     */
    static readModerationStatusFilter(status) {
        const normalizedStatus = this.normalizeStatus(status);
        return normalizedStatus;
    }

    /**
     * Checks whether an owner may still manage an event through the legacy delete-oriented contract.
     */
    static canOwnerManageStatus(status) {
        return Event.canOwnerDeleteStatus(status);
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
            rejectionReason: Event.normalizeRejectionReason(row.rejectionReason || row.rejection_reason),
            calendarLink: Event.normalizeCalendarLink(row.calendarLink || row.calendar_link),
            calendarEventId: Event.normalizeCalendarEventId(row.calendarEventId || row.calendar_event_id),
            organizerId: row.organizerId || row.organizer_id,
            organizerName: typeof (row.organizerName || row.organizer_name) === 'string'
                ? (row.organizerName || row.organizer_name).trim() || undefined
                : undefined,
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
            rejection_reason: this.normalizeRejectionReason(event.rejectionReason),
            calendar_link: this.normalizeCalendarLink(event.calendarLink),
            calendar_event_id: this.normalizeCalendarEventId(event.calendarEventId),
            organizer_id: event.organizerId,
            created_at: this.driver.toDateTime(event.createdAt || Date.now()),
        };
    }

    /**
     * Serializes editable event fields without overwriting immutable columns.
     */
    static serializeEditablePayload(payload = {}) {
        const serialized = Object.fromEntries(Object.entries({
            title: payload.title,
            description: payload.description,
            date: payload.date ? this.driver.toDateTime(payload.date) : undefined,
            category: payload.category ? normalizeEventCategoryId(payload.category, { fallback: 'outro' }) : undefined,
            location: payload.location,
            status: payload.status ? this.normalizeStatus(payload.status) : undefined,
        }).filter(([, value]) => value !== undefined));

        if (Object.prototype.hasOwnProperty.call(payload, 'rejectionReason')) {
            serialized.rejection_reason = this.normalizeRejectionReason(payload.rejectionReason);
        }

        if (Object.prototype.hasOwnProperty.call(payload, 'calendarLink')) {
            serialized.calendar_link = this.normalizeCalendarLink(payload.calendarLink);
        }

        if (Object.prototype.hasOwnProperty.call(payload, 'calendarEventId')) {
            serialized.calendar_event_id = this.normalizeCalendarEventId(payload.calendarEventId);
        }

        return serialized;
    }

    /**
     * Retrieves multiple events using the base model lookup.
     */
    static async find(options = {}) {
        return super.find(options);
    }

    /**
     * Retrieves a single event using the base model lookup.
     */
    static async get(clause, { view = this.view } = {}) {
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
        const event = payload instanceof Event ? payload.toJSON() : new Event(payload).toJSON();
        const serialized = await this.insert(event);
        return this.get(serialized.id);
    }

    /**
     * Loads organizer names for a list of events through the relation helper.
     */
    static async #hydrateOrganizerNames(events = []) {
        if (!Array.isArray(events) || events.length === 0) {
            return [];
        }

        const organizerRelation = new Relation(User.table, {}, 'id', User.driver);
        const organizers = await organizerRelation.getMany(
            events.map(event => event.organizerId),
            { view: ['id', 'name'] },
        );
        const organizerNamesById = new Map(
            organizers.map(organizer => [String(organizer.id), User.normalizeName(organizer.name)]),
        );

        return events.map(event => ({
            ...event,
            organizerName: organizerNamesById.get(String(event.organizerId)),
        }));
    }

    /**
     * Checks whether one list filter value contains a dash-separated local date and time.
     */
    static #isDateTimeValue(value) {
        const dateTimePattern = /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}$/;
        return typeof value === 'string' && dateTimePattern.test(value.trim());
    }

    /**
     * Checks whether one list filter value is a calendar day without an explicit time component.
     */
    static #isDateOnlyValue(value) {
        const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
        return typeof value === 'string' && dateOnlyPattern.test(value.trim());
    }

    /**
     * Parses any date-like filter value into a local Date instance or returns null for invalid inputs.
     */
    static parseDateTimeInput(value) {
        if (Event.#isDateTimeValue(value)) {
            const dateTimePattern = /^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})$/;
            const match = dateTimePattern.exec(value.trim());

            if (!match) {
                return null;
            }

            const year = Number.parseInt(match[1], 10);
            const month = Number.parseInt(match[2], 10);
            const day = Number.parseInt(match[3], 10);
            const hour = Number.parseInt(match[4], 10);
            const minute = Number.parseInt(match[5], 10);
            const date = new Date(year, month - 1, day, hour, minute);

            if (
                Number.isNaN(date.getTime())
                || date.getFullYear() !== year
                || date.getMonth() !== month - 1
                || date.getDate() !== day
                || date.getHours() !== hour
                || date.getMinutes() !== minute
            ) {
                return null;
            }

            return date;
        }

        if (Event.#isDateOnlyValue(value)) {
            const dateOnlyPattern = /^(\d{4})-(\d{2})-(\d{2})$/;
            const match = dateOnlyPattern.exec(value.trim());

            if (!match) {
                return null;
            }

            const year = Number.parseInt(match[1], 10);
            const month = Number.parseInt(match[2], 10);
            const day = Number.parseInt(match[3], 10);
            const date = new Date(year, month - 1, day);

            if (
                Number.isNaN(date.getTime())
                || date.getFullYear() !== year
                || date.getMonth() !== month - 1
                || date.getDate() !== day
            ) {
                return null;
            }

            return date;
        }

        return null;
    }

    /**
     * Converts a date-like value into the local start or end of day and returns an ISO string.
     */
    static #getDayBoundary(value, boundary) {
        const normalizedValue = Event.parseDateTimeInput(value);
        if (!normalizedValue) {
            return value;
        }

        if (boundary === 'start') {
            normalizedValue.setHours(0, 0, 0, 0);
        }
        else if (boundary === 'end') {
            normalizedValue.setHours(23, 59, 59, 999);
        }
        return normalizedValue.toISOString();
    }

    /**
     * Checks whether one requested time zone value is usable for Intl-based normalization.
     */
    static #hasTimeZoneValue(timeZone) {
        return typeof timeZone === 'string' && timeZone.trim().length > 0;
    }

    /**
     * Converts a date-like value into the local equivalent in the requested time zone.
     */
    static #getLocalDateTimeForTimeZone(dateTimeValue, timeZone) {
        if (!dateTimeValue || !Event.#hasTimeZoneValue(timeZone)) {
            return dateTimeValue;
        }

        try {
            const localDateTime = new Date(dateTimeValue);
            if (Number.isNaN(localDateTime.getTime())) {
                return dateTimeValue;
            }

            const utcDateTime = new Date(localDateTime.toLocaleString('en-US', { timeZone: 'UTC' }));
            const targetDateTime = new Date(localDateTime.toLocaleString('en-US', { timeZone }));
            const offset = utcDateTime.getTime() - targetDateTime.getTime();
            const normalizedDateTime = new Date(localDateTime.getTime() + offset);
            return normalizedDateTime.toISOString();
        } catch {
            return dateTimeValue;
        }
    }

    /**
     * Normalizes a datetime or date-only value into an ISO string representing the local start or end of day in the requested time zone.
     */
    static #normalizeDateTime(value, { boundary = 'start', timeZone = null } = {}) {
        const dayBoundary = Event.#getDayBoundary(value, boundary);
        const normalizedDateTime = Event.#getLocalDateTimeForTimeZone(dayBoundary, timeZone);
        return normalizedDateTime;
    }

    /**
     * Lists events filtered by period, category, and free-text search.
     */
    static async list(filters = {}) {
        const { search, category, from, to, timezone } = filters;
        const queryFilter = {
            status: this.STATUS_PUBLISHED,
        };
        const normalizedFrom = Event.#normalizeDateTime(from, {
            boundary: 'start',
            timeZone: timezone,
        });
        const normalizedTo = Event.#normalizeDateTime(to, {
            boundary: 'end',
            timeZone: timezone,
        });

        if (from && to) {
            queryFilter.date = this.driver.between(
                this.driver.toDateTime(normalizedFrom),
                this.driver.toDateTime(normalizedTo),
            );
        } else if (from) {
            queryFilter.date = this.driver.gte(this.driver.toDateTime(normalizedFrom));
        } else if (to) {
            queryFilter.date = this.driver.lte(this.driver.toDateTime(normalizedTo));
        }

        const rows = await this.find({
            filter: queryFilter,
            opt: { order: { date: 1 } },
        });

        const normalizedCategory = normalizeEventCategoryId(category, { fallback: '' }).toLowerCase();
        const normalizedSearch = search?.toLowerCase();

        const filteredEvents = rows.filter(event => {
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

            return this.#hydrateOrganizerNames(filteredEvents);
    }

    /**
     * Lists the approved events scheduled for the same local Sunday-to-Saturday window used by the public week page.
     */
    static async listCurrentWeek(referenceDate = new Date(), { timeZone = null } = {}) {
        return this.list(getCurrentWeekRangeLocal(referenceDate, { timeZone }));
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
        const events = await this.find({
            filter: {
                status: status ? this.readModerationStatusFilter(status) : { not: this.STATUS_PUBLISHED },
                ...(moderatorId ? { organizer_id: { not: moderatorId } } : {}),
            },
            opt: { order: { date: 0 } },
        });

        return this.#hydrateOrganizerNames(events);
    }

    /**
     * Updates editable event fields and returns the persisted event.
     */
    static async updateDetails(id, payload = {}) {
        if (!id) {
            return null;
        }

        const serialized = this.serializeEditablePayload(payload);
        await this.driver.update(this.table, serialized, id);
        return this.get(id);
    }

    /**
     * Updates the moderation status for an event and returns the persisted event.
     */
    static async updateStatus(id, status, { rejectionReason, calendarLink, calendarEventId } = {}) {
        if (!id) {
            return null;
        }

        await this.driver.update(this.table, {
            status: this.normalizeStatus(status),
            rejection_reason: this.normalizeRejectionReason(rejectionReason),
            calendar_link: this.normalizeCalendarLink(calendarLink),
            calendar_event_id: this.normalizeCalendarEventId(calendarEventId),
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

        await super.delete(id, { limit: 1 });
    }
}
