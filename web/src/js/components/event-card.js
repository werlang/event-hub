import { BaseComponent } from './base-component.js';
import { formatDateTimePtBr } from '../helpers/date-format.js';
import { isPastEvent } from '../helpers/event-sort.js';
import { readEventTagSummary } from '../helpers/event-category.js';
import { createLocationContent } from '../helpers/location-link.js';

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

/**
 * Creates one Font Awesome icon element for card metadata.
 */
function createCardIcon(icon) {
	const iconElement = document.createElement('i');
	iconElement.classList.add('fa-solid', `fa-${icon}`);
	iconElement.setAttribute('aria-hidden', 'true');
	return iconElement;
}

/**
 * Creates one metadata pill for an event card.
 */
function createMetaItem(icon, content) {
	const item = document.createElement('span');
	item.append(createCardIcon(icon), content);
	return item;
}

/**
	* Creates one compact tag chip for the event card.
	*/
function createTagChip(label, modifier = '') {
	const chip = document.createElement('span');
	chip.className = modifier ? `card__tag card__tag--${modifier}` : 'card__tag';
	chip.textContent = readText(label, 'Outro');
	return chip;
}

/**
	* Creates the tag row rendered above the metadata pills.
	*/
function createTagList(event) {
	const summary = readEventTagSummary(event, { visibleCount: 2 });
	if (summary.tags.length === 0) {
		return null;
	}

	const list = document.createElement('div');
	list.className = 'card__tags';
	summary.visibleTags.forEach((tag) => {
		list.appendChild(createTagChip(tag.label));
	});

	if (summary.hiddenCount > 0) {
		const overflowChip = createTagChip(`+${summary.hiddenCount}`, 'more');
		overflowChip.title = summary.hiddenTags.map(tag => tag.label).join(', ');
		list.appendChild(overflowChip);
	}

	return list;
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
			state.append(createCardIcon('clock-rotate-left'), document.createTextNode('Evento passado'));
			fragment.appendChild(state);
		}

		const title = document.createElement('div');
		title.className = 'card__title';
		title.textContent = readText(this.#event?.title, 'Sem título');
		fragment.appendChild(title);

		const description = document.createElement('p');
		description.textContent = readText(this.#event?.description, 'Sem descrição.');
		fragment.appendChild(description);

		const tags = createTagList(this.#event);
		if (tags) {
			fragment.appendChild(tags);
		}

		const meta = document.createElement('div');
		meta.className = 'card__meta';

		meta.append(
			createMetaItem('location-dot', createLocationContent(this.#event?.location, {
				fallback: 'A definir',
				linkClass: 'card__meta-link',
			})),
			createMetaItem('calendar-days', document.createTextNode(formatDateTimePtBr(this.#event?.date))),
		);

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
