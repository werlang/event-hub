/**
 * Normalizes a date-like value to the local start of day.
 */
function toStartOfLocalDay(dateValue) {
	const date = new Date(dateValue);
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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
