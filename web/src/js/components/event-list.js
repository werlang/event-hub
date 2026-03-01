import { renderEventCard } from './event-card.js';

export class EventList {
	constructor({ grid, emptyState }) {
		this.grid = grid;
		this.emptyState = emptyState;
	}

	isReady() {
		return Boolean(this.grid && this.emptyState);
	}

	render(events) {
		if (!this.isReady()) {
			return;
		}

		if (!Array.isArray(events) || events.length === 0) {
			this.grid.innerHTML = '';
			this.emptyState.hidden = false;
			return;
		}

		this.emptyState.hidden = true;
		this.grid.innerHTML = events.map(renderEventCard).join('');
	}
}
