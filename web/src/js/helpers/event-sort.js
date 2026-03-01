function toTimestamp(value) {
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? Number.POSITIVE_INFINITY : date.getTime();
}

export function sortEventsByDate(events) {
	if (!Array.isArray(events)) {
		return [];
	}

	return [...events].sort((left, right) => {
		return toTimestamp(left?.date) - toTimestamp(right?.date);
	});
}
