import { requestApi } from '../helpers/api.js';
import {
	hydrateHomeFilters,
	serializeHomeFilters,
	syncUrlWithParams,
} from '../helpers/query-state.js';
import { sortEventsByDate } from '../helpers/event-sort.js';
import { EventList } from '../components/event-list.js';

function createElements() {
	return {
		grid: document.querySelector('#events-grid'),
		emptyState: document.querySelector('#empty-state'),
		filterSearch: document.querySelector('#filter-search'),
		filterCategory: document.querySelector('#filter-category'),
		filterFrom: document.querySelector('#filter-from'),
		filterTo: document.querySelector('#filter-to'),
		applyFilters: document.querySelector('#apply-filters'),
	};
}

export function initHomePage() {
	const elements = createElements();
	const eventList = new EventList({
		grid: elements.grid,
		emptyState: elements.emptyState,
	});

	if (!eventList.isReady() || !elements.applyFilters) {
		return;
	}

	const loadEvents = async () => {
		const params = serializeHomeFilters(elements);
		syncUrlWithParams(params);

		const query = params.toString();
		const endpoint = query ? `/events?${query}` : '/events';
		const response = await requestApi(endpoint);
		if (!response.ok) {
			eventList.render([]);
			return;
		}

		const events = response.data?.events;
		eventList.render(sortEventsByDate(events));
	};

	hydrateHomeFilters(elements);
	elements.applyFilters.addEventListener('click', loadEvents);
	loadEvents();
}
