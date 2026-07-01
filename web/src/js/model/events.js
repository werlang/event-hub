import { apiClient } from '../helpers/api.js';

/**
 * Encapsulates event API paths used by browser pages and dashboard modules.
 */
export class EventApi {
    #client;

    /**
     * Creates an event API facade backed by the shared API client.
     */
    constructor({ client = apiClient } = {}) {
        this.#client = client;
    }

    /**
     * Lists public events, optionally constrained by URLSearchParams.
     */
    listPublic(params = null, options = {}) {
        return this.#client.request(this.#createPublicPath(params), options);
    }

    /**
     * Lists events owned by the current authenticated user.
     */
    listMine(token) {
        return this.#client.request('/events/mine', { token });
    }

    /**
     * Lists moderation queue events with an optional status filter.
     */
    listModeration(token, { status = '' } = {}) {
        const params = new URLSearchParams();
        if (status) {
            params.set('status', status);
        }

        const query = params.toString();
        return this.#client.request(query ? `/events/moderation?${query}` : '/events/moderation', { token });
    }

    /**
     * Creates one event for moderation.
     */
    create(token, payload) {
        return this.#client.request('/events', {
            method: 'POST',
            token,
            body: payload,
        });
    }

    /**
     * Updates one event and sends it back through moderation.
     */
    update(token, eventId, payload) {
        return this.#client.request(this.#eventPath(eventId), {
            method: 'PUT',
            token,
            body: payload,
        });
    }

    /**
     * Deletes one event by id.
     */
    delete(token, eventId) {
        return this.#client.request(this.#eventPath(eventId), {
            method: 'DELETE',
            token,
        });
    }

    /**
     * Applies one moderation decision to an event.
     */
    moderate(token, eventId, payload) {
        return this.#client.request(`${this.#eventPath(eventId)}/moderation`, {
            method: 'PUT',
            token,
            body: payload,
        });
    }

    /**
     * Builds a public event-list path from supported query inputs.
     */
    #createPublicPath(params) {
        const searchParams = params instanceof URLSearchParams
            ? params
            : new URLSearchParams(params || {});
        const query = searchParams.toString();

        return query ? `/events?${query}` : '/events';
    }

    /**
     * Builds a safe event-member path segment.
     */
    #eventPath(eventId) {
        return `/events/${encodeURIComponent(String(eventId || ''))}`;
    }
}

export const eventApi = new EventApi();

