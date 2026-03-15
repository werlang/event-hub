import { BaseComponent } from './base-component.js';
import { EventCard } from './event-card.js';
import { sortEventsByDate } from '../helpers/event-sort.js';

export class EventList extends BaseComponent {
	#emptyState;
	#defaultEmptyMessage;

	/**
	 * Creates a list wrapper around the event grid and empty-state element.
	 */
	constructor({ grid, emptyState }) {
		super(grid);
		this.#emptyState = emptyState ?? null;
		this.#defaultEmptyMessage = emptyState?.textContent || 'Nenhum evento encontrado.';
	}

	/**
	 * Reports whether the event grid is available.
	 */
	isReady() {
		return super.isReady();
	}

	/**
	 * Renders the provided events or clears the grid when none exist.
	 */
	render(events, { emptyMessage, showEmptyState = true } = {}) {
		if (!this.isReady()) {
			return this;
		}

		if (this.#emptyState) {
			this.#emptyState.textContent = emptyMessage || this.#defaultEmptyMessage;
		}

		const sortedEvents = Array.isArray(events) ? sortEventsByDate(events) : [];
		if (sortedEvents.length === 0) {
			this.get().replaceChildren();
			if (this.#emptyState) {
				this.#emptyState.hidden = !showEmptyState;
			}
			return this;
		}

		const fragment = document.createDocumentFragment();
		sortedEvents.forEach((event) => {
			fragment.appendChild(new EventCard(event).get());
		});

		this.get().replaceChildren(fragment);
		if (this.#emptyState) {
			this.#emptyState.hidden = true;
		}
		return this;
	}

	/**
	 * Clears the event grid while preserving optional empty-state behavior.
	 */
	clear({ emptyMessage, showEmptyState } = {}) {
		return this.render([], { emptyMessage, showEmptyState });
	}
}
