function normalize(value) {
	if (typeof value !== 'string') {
		return '';
	}

	return value.trim();
}

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
