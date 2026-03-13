/**
 * Reports whether a value stores only a calendar day.
 */
function isDateOnlyValue(value) {
	return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Reports whether a value represents a date-only payload normalized to midnight UTC.
 */
function isDateOnlyIsoValue(value) {
	return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T00:00:00(?:\.000)?Z$/.test(value);
}

/**
 * Converts a normalized YYYY-MM-DD value into a local Date instance.
 */
function createLocalDate(value) {
	const [yearText, monthText, dayText] = String(value).split('-');
	const year = Number(yearText);
	const month = Number(monthText);
	const day = Number(dayText);

	return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/**
 * Formats a date-time value using the pt-BR locale.
 */
export function formatDateTimePtBr(value) {
	const normalizedValue = typeof value === 'string' ? value.trim() : value;
	const isDateOnly = isDateOnlyValue(normalizedValue) || isDateOnlyIsoValue(normalizedValue);
	const date = isDateOnly
		? createLocalDate(String(normalizedValue).slice(0, 10))
		: new Date(normalizedValue);

	if (Number.isNaN(date.getTime())) {
		return 'Data não informada';
	}

	return new Intl.DateTimeFormat('pt-BR', isDateOnly
		? { dateStyle: 'short' }
		: {
			dateStyle: 'short',
			timeStyle: 'short',
		}).format(date);
}
