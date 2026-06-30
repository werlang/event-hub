import { BaseComponent } from './base-component.js';
import { createLinkedTextContent } from './linked-text.js';
import { Tooltip } from './tooltip.js';
import { Event } from '../helpers/event.js';

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
	const iconClasses = typeof icon === 'string' && icon.includes(' ')
		? icon.trim().split(/\s+/)
		: ['fa-solid', `fa-${icon}`];
	iconElement.classList.add(...iconClasses);
	iconElement.setAttribute('aria-hidden', 'true');
	return iconElement;
}

/**
	* Creates one metadata pill for an event card.
	*/
function createMetaItem(icon, content, modifier = '') {
	const item = document.createElement('span');
	item.className = modifier ? `card__meta-item card__meta-item--${modifier}` : 'card__meta-item';
	item.append(createCardIcon(icon), content);
	return item;
}

/**
	* Creates one status pill for the event card header.
	*/
function createStatusPill(icon, label, modifier = '') {
	const status = document.createElement('span');
	status.className = modifier ? `card__status card__status--${modifier}` : 'card__status';
	status.append(createCardIcon(icon), document.createTextNode(label));
	return status;
}

/**
	* Creates the timeline pill rendered beside the public event title.
	*/
function createTimelinePill(event) {
	const timeline = event.readTimelineMeta();
	const pill = createStatusPill(timeline.icon, timeline.label, timeline.modifier);

	new Tooltip({
		element: pill,
		content: timeline.tooltipContent,
		label: timeline.tooltipLabel,
		useHostTrigger: true,
	});

	return pill;
}

/**
	* Creates the compact Google Calendar action rendered beside the timeline pill.
	*/
function createGoogleCalendarStatusAction(event) {
	const calendar = event.readCalendarPresentation();
	if (!calendar.isLink) {
		return null;
	}

	const link = document.createElement('a');
	link.className = 'card__status card__status--calendar-action';
	link.href = calendar.href;
	link.target = '_blank';
	link.rel = 'noopener noreferrer';
	link.title = calendar.title || calendar.label;
	link.setAttribute('aria-label', calendar.title || calendar.label);
	link.appendChild(createCardIcon('fa-brands fa-google'));

	new Tooltip({
		element: link,
		content: calendar.title || calendar.label,
		label: 'Abrir no Google Agenda',
		useHostTrigger: true,
	});

	return link;
}

/**
	* Creates the category pill shown in the public card metadata row.
	*/
function createCategoryMetaItem(event) {
	const category = event.readCategoryMeta();
	return createMetaItem('tag', document.createTextNode(category.label), 'category');
}

/**
 * Creates the compact date meta item with a hover tooltip.
 */
function createDateMetaItem(event) {
	const item = createMetaItem('calendar-days', document.createTextNode(event.formatDateTimePtBr()), 'date');

	new Tooltip({
		element: item,
		content: event.formatDateTimeTooltipPtBr(),
		label: 'Ver data completa',
		useHostTrigger: true,
	});

	return item;
}

export class EventCard extends BaseComponent {
	#event = new Event();

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
		return this.#event.toJSON();
	}

	/**
	 * Stores the event data and re-renders the card.
	 */
	setEvent(event = {}) {
		this.#event = Event.from(event);
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
		const pastEvent = this.#event.isPast();
		element.className = pastEvent ? 'card card--past' : 'card';

		const fragment = document.createDocumentFragment();
		const header = document.createElement('div');
		header.className = 'card__header';

		const headline = document.createElement('div');
		headline.className = 'card__headline';

		const title = document.createElement('h3');
		title.className = 'card__title';
		title.textContent = this.#event.readTitle('Sem título');

		const author = document.createElement('p');
		author.className = 'card__author';
		author.textContent = this.#event.readAuthorText();

		const titleBlock = document.createElement('div');
		titleBlock.className = 'card__title-block';
		titleBlock.append(title, author);

		const statusGroup = document.createElement('div');
		statusGroup.className = 'card__status-group';
		const calendarStatusAction = createGoogleCalendarStatusAction(this.#event);

		if (calendarStatusAction) {
			statusGroup.appendChild(calendarStatusAction);
		}
		statusGroup.appendChild(createTimelinePill(this.#event));

		headline.appendChild(titleBlock);
		header.append(headline, statusGroup);
		fragment.appendChild(header);

		const description = document.createElement('p');
		description.className = 'card__description';
		description.appendChild(createLinkedTextContent(
			this.#event.readDescriptionSegments('Sem descrição.'),
			{ linkClass: 'card__description-link' },
		));
		fragment.appendChild(description);

		const meta = document.createElement('div');
		meta.className = 'card__meta';

		meta.append(createCategoryMetaItem(this.#event));

		meta.append(
			createMetaItem('location-dot', this.#event.createLocationContent({
				fallback: 'A definir',
				linkClass: 'card__meta-link',
			}), 'location'),
			createDateMetaItem(this.#event),
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
