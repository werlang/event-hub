import { BaseComponent } from './base-component.js';
import { EventCard } from './event-card.js';
import { sortEventsByDate } from '../helpers/event-sort.js';

export class EventList extends BaseComponent {
	#emptyState;
	#defaultEmptyMessage;

	constructor({ grid, emptyState }) {
		super(grid);
		this.#emptyState = emptyState ?? null;
		this.#defaultEmptyMessage = emptyState?.textContent || 'Nenhum evento encontrado.';
	}

	isReady() {
		return super.isReady() && Boolean(this.#emptyState);
	}

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

	clear({ emptyMessage } = {}) {
		return this.render([], { emptyMessage });
	}
}
