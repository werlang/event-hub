/**
 * Reports whether a value is a YYYY-MM-DD date-only string.
 */
function isDateOnlyValue(value) {
	return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Reports whether a value is a midnight-UTC ISO string carrying only a calendar day.
 */
function isDateOnlyIsoValue(value) {
	return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T00:00:00(?:\.000)?Z$/.test(value);
}

/**
 * Extracts the normalized YYYY-MM-DD token from a supported date-only value.
 */
function readDateOnlyDay(value) {
	if (isDateOnlyValue(value)) {
		return value;
	}

	if (isDateOnlyIsoValue(value)) {
		return value.slice(0, 10);
	}

	return null;
}

/**
 * Converts a date-only string into a local timestamp.
 */
function toLocalDateOnlyTimestamp(value) {
	const [yearText, monthText, dayText] = String(value).split('-');
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);

	if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
		return Number.POSITIVE_INFINITY;
	}

	return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
}

/**
 * Converts a date-like value into a comparable timestamp.
 */
function toTimestamp(value) {
	const dateOnlyDay = readDateOnlyDay(value);
	if (dateOnlyDay) {
		return toLocalDateOnlyTimestamp(dateOnlyDay);
	}

	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? Number.POSITIVE_INFINITY : date.getTime();
}

/**
 * Converts an event date into a day-level sort key.
 */
function toDayKey(value) {
	const dateOnlyDay = readDateOnlyDay(value);
	if (dateOnlyDay) {
		return dateOnlyDay;
	}

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return '9999-12-31';
	}

	const year = String(date.getFullYear());
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

/**
 * Reports whether an event stores only a calendar day without time.
 */
export function isDateOnlyEvent(event) {
	return Boolean(readDateOnlyDay(event?.date));
}

/**
 * Reports whether an event date is already in the past.
 */
export function isPastEvent(event, referenceDate = new Date()) {
	const value = event?.date;
	if (!value) {
		return false;
	}

	const dateOnlyDay = readDateOnlyDay(value);
	if (dateOnlyDay) {
		const [yearText, monthText, dayText] = dateOnlyDay.split('-');
		const year = Number(yearText);
		const month = Number(monthText);
		const day = Number(dayText);
		const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
		return Number.isFinite(endOfDay) && endOfDay < referenceDate.getTime();
	}

	const timestamp = toTimestamp(value);
	return Number.isFinite(timestamp) && timestamp < referenceDate.getTime();
}

/**
 * Returns a new event array sorted chronologically.
 */
export function sortEventsByDate(events) {
	if (!Array.isArray(events)) {
		return [];
	}

	return [...events].sort((left, right) => {
		const leftDay = toDayKey(left?.date);
		const rightDay = toDayKey(right?.date);

		if (leftDay !== rightDay) {
			return leftDay.localeCompare(rightDay);
		}

		const leftDateOnly = isDateOnlyEvent(left);
		const rightDateOnly = isDateOnlyEvent(right);

		if (leftDateOnly !== rightDateOnly) {
			return leftDateOnly ? -1 : 1;
		}

		return toTimestamp(left?.date) - toTimestamp(right?.date);
	});
}

/**
 * Returns a new event array sorted from the latest date to the earliest.
 */
export function sortEventsByDateDescending(events) {
	return sortEventsByDate(events).reverse();
}
