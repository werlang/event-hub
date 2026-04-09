const EDITABLE_EVENT_STATUSES = new Set(['pending', 'rejected']);
const DELETABLE_EVENT_STATUSES = new Set(['pending', 'rejected']);
const PENDING_LIKE_EVENT_STATUSES = new Set(['pending']);

/**
 * Normalizes a raw moderation status for dashboard management rules.
 */
export function normalizeEventStatus(status) {
    return String(status || '').trim().toLowerCase();
}

/**
 * Reports whether a status should behave like pending in dashboard flows.
 */
export function isPendingLikeEventStatus(eventOrStatus) {
    const normalizedStatus = typeof eventOrStatus === 'string'
        ? normalizeEventStatus(eventOrStatus)
        : normalizeEventStatus(eventOrStatus?.status);

    return PENDING_LIKE_EVENT_STATUSES.has(normalizedStatus);
}

/**
 * Reports whether the authenticated owner may still edit an event.
 */
export function canEditOwnEvent(eventOrStatus) {
    const normalizedStatus = typeof eventOrStatus === 'string'
        ? normalizeEventStatus(eventOrStatus)
        : normalizeEventStatus(eventOrStatus?.status);

    return EDITABLE_EVENT_STATUSES.has(normalizedStatus);
}

/**
 * Reports whether the authenticated owner may still delete an event.
 */
export function canDeleteOwnEvent(eventOrStatus) {
    const normalizedStatus = typeof eventOrStatus === 'string'
        ? normalizeEventStatus(eventOrStatus)
        : normalizeEventStatus(eventOrStatus?.status);

    return DELETABLE_EVENT_STATUSES.has(normalizedStatus);
}

/**
 * Reports whether the authenticated owner may still manage an event through the legacy delete-oriented contract.
 */
export function canManageOwnEvent(eventOrStatus) {
    return canDeleteOwnEvent(eventOrStatus);
}

/**
 * Reports whether the shared dashboard event form may open for one event.
 */
export function canOpenEventForm(eventOrStatus, { allowAdminEdit = false } = {}) {
    if (allowAdminEdit) {
        return true;
    }

    return canEditOwnEvent(eventOrStatus);
}

/**
 * Formats an ISO-like value into the datetime-local input shape.
 */
export function formatDateTimeLocalInputValue(value) {
    const parsedDate = new Date(value);

    if (Number.isNaN(parsedDate.getTime())) {
        return '';
    }

    const year = String(parsedDate.getFullYear());
    const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const day = String(parsedDate.getDate()).padStart(2, '0');
    const hours = String(parsedDate.getHours()).padStart(2, '0');
    const minutes = String(parsedDate.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Converts a datetime-local field value into an ISO timestamp.
 */
export function serializeDateTimeLocalInputValue(value) {
    const normalizedValue = String(value || '').trim();
    if (!normalizedValue) {
        return '';
    }

    const parsedDate = new Date(normalizedValue);
    if (Number.isNaN(parsedDate.getTime())) {
        return '';
    }

    return parsedDate.toISOString();
}