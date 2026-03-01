import { formatDateTimePtBr } from '../helpers/date-format.js';

function escapeHtml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');
}

export function renderEventCard(event) {
	return `
		<article class="card">
			<div class="card__title">${escapeHtml(event?.title || 'Sem título')}</div>
			<p>${escapeHtml(event?.description || 'Sem descrição.')}</p>
			<div class="card__meta">
				<span>${escapeHtml(event?.category || 'Geral')}</span>
				<span>${escapeHtml(event?.location || 'A definir')}</span>
				<span>${escapeHtml(formatDateTimePtBr(event?.date))}</span>
			</div>
		</article>
	`;
}
