/**
 * Normalizes a date or time field value into a trimmed string.
 */
function normalize(value) {
	if (typeof value !== 'string') {
		return '';
	}

	return value.trim();
}

/**
 * Serializes publish-form date fields into the API date payload format.
 */
export function serializeEventDate({ date, time, includeTime }) {
	const normalizedDate = normalize(date);
	if (!normalizedDate) {
		return '';
	}

	if (!includeTime) {
		return normalizedDate;
	}

	const normalizedTime = normalize(time);
	if (!normalizedTime) {
		return '';
	}

	return `${normalizedDate}T${normalizedTime}`;
}
