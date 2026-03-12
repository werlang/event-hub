/**
 * Formats a date-time value using the pt-BR locale.
 */
export function formatDateTimePtBr(value) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return 'Data não informada';
	}

	return new Intl.DateTimeFormat('pt-BR', {
		dateStyle: 'short',
		timeStyle: 'short',
	}).format(date);
}
