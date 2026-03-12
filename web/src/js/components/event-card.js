import { BaseComponent } from './base-component.js';
import { formatDateTimePtBr } from '../helpers/date-format.js';
import { isPastEvent } from '../helpers/event-sort.js';

/**
 * Normalizes card text content while preserving a fallback label.
 */
function readText(value, fallback) {
	if (typeof value !== 'string') {
		return fallback;
	}

	const normalized = value.trim();
	return normalized || fallback;
}

export class EventCard extends BaseComponent {
	#event = {};

	/**
	 * Creates an event card wrapper for the provided event data.
	 */
	constructor(event = {}) {
		super(document.createElement('article'));
		this.setEvent(event);
	}

	/**
	 * Returns a copy of the event currently rendered by the card.
	 */
	getEvent() {
		return { ...this.#event };
	}

	/**
	 * Stores the event data and re-renders the card.
	 */
	setEvent(event = {}) {
		this.#event = event && typeof event === 'object' ? event : {};
		this.#render();
		return this;
	}

	/**
	 * Returns the rendered event card markup.
	 */
	toMarkup() {
		return this.get()?.outerHTML || '';
	}

	/**
	 * Renders the event card DOM structure.
	 */
	#render() {
		const element = this.get();
		const pastEvent = isPastEvent(this.#event);
		element.className = pastEvent ? 'card card--past' : 'card';

		const fragment = document.createDocumentFragment();

		if (pastEvent) {
			const state = document.createElement('span');
			state.className = 'card__state';
			state.textContent = 'Evento passado';
			fragment.appendChild(state);
		}

		const title = document.createElement('div');
		title.className = 'card__title';
		title.textContent = readText(this.#event?.title, 'Sem título');
		fragment.appendChild(title);

		const description = document.createElement('p');
		description.textContent = readText(this.#event?.description, 'Sem descrição.');
		fragment.appendChild(description);

		const meta = document.createElement('div');
		meta.className = 'card__meta';

		[
			readText(this.#event?.category, 'Geral'),
			readText(this.#event?.location, 'A definir'),
			formatDateTimePtBr(this.#event?.date),
		].forEach((value) => {
			const item = document.createElement('span');
			item.textContent = value;
			meta.appendChild(item);
		});

		fragment.appendChild(meta);
		element.replaceChildren(fragment);
	}
}

/**
 * Renders an event card directly to an HTML string.
 */
export function renderEventCard(event) {
	return new EventCard(event).toMarkup();
}
