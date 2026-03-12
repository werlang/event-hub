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
	 * Reports whether both the grid and empty state are available.
	 */
	isReady() {
		return super.isReady() && Boolean(this.#emptyState);
	}

	/**
	 * Renders the provided events or the empty-state message when none exist.
	 */
	render(events, { emptyMessage } = {}) {
		if (!this.isReady()) {
			return this;
		}

		this.#emptyState.textContent = emptyMessage || this.#defaultEmptyMessage;

		const sortedEvents = Array.isArray(events) ? sortEventsByDate(events) : [];
		if (sortedEvents.length === 0) {
			this.get().replaceChildren();
			this.#emptyState.hidden = false;
			return this;
		}

		const fragment = document.createDocumentFragment();
		sortedEvents.forEach((event) => {
			fragment.appendChild(new EventCard(event).get());
		});

		this.get().replaceChildren(fragment);
		this.#emptyState.hidden = true;
		return this;
	}

	/**
	 * Clears the event grid while preserving the empty-state message flow.
	 */
	clear({ emptyMessage } = {}) {
		return this.render([], { emptyMessage });
	}
}
