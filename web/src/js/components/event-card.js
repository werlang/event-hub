import { BaseComponent } from './base-component.js';
import { formatDateTimePtBr } from '../helpers/date-format.js';
import { isPastEvent } from '../helpers/event-sort.js';

function readText(value, fallback) {
	if (typeof value !== 'string') {
		return fallback;
	}

	const normalized = value.trim();
	return normalized || fallback;
}

export class EventCard extends BaseComponent {
	#event = {};

	constructor(event = {}) {
		super(document.createElement('article'));
		this.setEvent(event);
	}

	getEvent() {
		return { ...this.#event };
	}

	setEvent(event = {}) {
		this.#event = event && typeof event === 'object' ? event : {};
		this.#render();
		return this;
	}

	toMarkup() {
		return this.get()?.outerHTML || '';
	}

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

export function renderEventCard(event) {
	return new EventCard(event).toMarkup();
}
