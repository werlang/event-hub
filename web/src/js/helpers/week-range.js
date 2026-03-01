function toStartOfLocalDay(dateValue) {
	const date = new Date(dateValue);
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDateInput(dateValue) {
	const date = toStartOfLocalDay(dateValue);
	const year = String(date.getFullYear());
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

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
