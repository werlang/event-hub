/**
 * Normalizes a date-like value to the local start of day.
 */
function toStartOfLocalDay(dateValue) {
    const date = new Date(dateValue);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Normalizes a date-like value to the local start of the equivalent day in a target time zone.
 */
function toStartOfTimeZoneDay(dateValue, timeZone) {
    if (!timeZone) {
        return toStartOfLocalDay(dateValue);
    }

    const date = new Date(dateValue);
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(date);
    const year = Number(parts.find(part => part.type === 'year')?.value);
    const month = Number(parts.find(part => part.type === 'month')?.value);
    const day = Number(parts.find(part => part.type === 'day')?.value);

    return new Date(year, month - 1, day);
}

/**
 * Formats a date-like value as a YYYY-MM-DD local calendar day.
 */
function formatDateInput(dateValue) {
    const date = toStartOfLocalDay(dateValue);
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Returns the current local Sunday-to-Saturday range.
 */
export function getCurrentWeekRangeLocal(referenceDate = new Date(), { timeZone = null } = {}) {
    const start = toStartOfTimeZoneDay(referenceDate, timeZone);
    start.setDate(start.getDate() - start.getDay());

    const end = toStartOfLocalDay(start);
    end.setDate(start.getDate() + 6);

    return {
        from: formatDateInput(start),
        to: formatDateInput(end),
    };
}