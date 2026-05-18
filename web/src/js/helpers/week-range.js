/**
 * Normalizes a date-like value to the local start of day.
 */
function toStartOfLocalDay(dateValue) {
    const date = new Date(dateValue);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Parses one YYYY-MM-DD input into a strict local Date instance.
 */
function parseDateInput(value) {
    const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(typeof value === 'string' ? value.trim() : '');

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

/**
 * Formats a date-like value for date input fields.
 */
function formatDateInput(dateValue) {
    const date = toStartOfLocalDay(dateValue);
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Expands a date-only list end filter into an inclusive end-of-day timestamp.
 */
export function normalizeInclusiveEndDateTime(value) {
    const normalized = typeof value === 'string' ? value.trim() : '';

    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
        return normalized;
    }

    return `${normalized}-23-59`;
}

/**
 * Returns the current local Sunday-to-Saturday range.
 */
export function getCurrentWeekRangeLocal(referenceDate = new Date()) {
    const start = toStartOfLocalDay(referenceDate);
    start.setDate(start.getDate() - start.getDay());

    const end = toStartOfLocalDay(start);
    end.setDate(start.getDate() + 6);

    return {
        from: formatDateInput(start),
        to: formatDateInput(end),
    };
}

/**
 * Normalizes one date-input value, falling back to the provided local date.
 */
export function normalizeDateInput(value, fallbackDate = new Date()) {
    return formatDateInput(parseDateInput(value) || fallbackDate);
}

/**
 * Returns the local Sunday-to-Saturday range containing the provided date input.
 */
export function getWeekRangeFromDateInput(value, fallbackDate = new Date()) {
    return getCurrentWeekRangeLocal(parseDateInput(value) || fallbackDate);
}

/**
 * Returns a local date range starting today for the requested number of days.
 */
export function getNextDaysRangeLocal(totalDays = 7, referenceDate = new Date()) {
    const days = Number.isInteger(totalDays) && totalDays > 0 ? totalDays : 7;
    const start = toStartOfLocalDay(referenceDate);
    const end = toStartOfLocalDay(start);
    end.setDate(start.getDate() + (days - 1));

    return {
        from: formatDateInput(start),
        to: formatDateInput(end),
    };
}
