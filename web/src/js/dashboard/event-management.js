const MANAGEABLE_EVENT_STATUSES = new Set(['pending', 'rejected']);

/**
 * Normalizes a raw moderation status for dashboard management rules.
 */
export function normalizeEventStatus(status) {
    return String(status || '').trim().toLowerCase();
}

/**
 * Reports whether the authenticated owner may still manage an event.
 */
export function canManageOwnEvent(eventOrStatus) {
    const normalizedStatus = typeof eventOrStatus === 'string'
        ? normalizeEventStatus(eventOrStatus)
        : normalizeEventStatus(eventOrStatus?.status);

    return MANAGEABLE_EVENT_STATUSES.has(normalizedStatus);
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