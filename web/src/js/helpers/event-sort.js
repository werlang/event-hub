/**
 * Reports whether a value is a YYYY-MM-DD date-only string.
 */
function isDateOnlyValue(value) {
	return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
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
	if (isDateOnlyValue(value)) {
		return toLocalDateOnlyTimestamp(value);
	}

	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? Number.POSITIVE_INFINITY : date.getTime();
}

/**
 * Converts an event date into a day-level sort key.
 */
function toDayKey(value) {
	if (isDateOnlyValue(value)) {
		return value;
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
	return isDateOnlyValue(event?.date);
}

/**
 * Reports whether an event date is already in the past.
 */
export function isPastEvent(event, referenceDate = new Date()) {
	const value = event?.date;
	if (!value) {
		return false;
	}

	if (isDateOnlyValue(value)) {
		const [yearText, monthText, dayText] = value.split('-');
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
