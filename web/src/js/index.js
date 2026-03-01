import '../css/index.css';
import { TemplateVar } from './helpers/template-var.js';
import { requestApi } from './helpers/api.js';
import { initLoginPage } from './login.js';
import { initPublishPage } from './publish.js';

const page = TemplateVar.get('page');

const homeElements = {
	grid: document.querySelector('#events-grid'),
	emptyState: document.querySelector('#empty-state'),
	filterSearch: document.querySelector('#filter-search'),
	filterCategory: document.querySelector('#filter-category'),
	filterFrom: document.querySelector('#filter-from'),
	filterTo: document.querySelector('#filter-to'),
	applyFilters: document.querySelector('#apply-filters'),
};

function escapeHtml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');
}

function formatDate(value) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return 'Data não informada';
	}

	return new Intl.DateTimeFormat('pt-BR', {
		dateStyle: 'short',
		timeStyle: 'short',
	}).format(date);
}

function serializeFilters() {
	const params = new URLSearchParams();
	const map = {
		search: homeElements.filterSearch?.value,
		category: homeElements.filterCategory?.value,
		from: homeElements.filterFrom?.value,
		to: homeElements.filterTo?.value,
	};

	Object.entries(map).forEach(([key, value]) => {
		const trimmed = typeof value === 'string' ? value.trim() : '';
		if (trimmed) {
			params.set(key, trimmed);
		}
	});

	return params;
}

function hydrateFiltersFromUrl() {
	const params = new URLSearchParams(window.location.search);
	if (homeElements.filterSearch) {
		homeElements.filterSearch.value = params.get('search') || params.get('q') || '';
	}
	if (homeElements.filterCategory) {
		homeElements.filterCategory.value = params.get('category') || '';
	}
	if (homeElements.filterFrom) {
		homeElements.filterFrom.value = params.get('from') || '';
	}
	if (homeElements.filterTo) {
		homeElements.filterTo.value = params.get('to') || '';
	}
}

function updateUrlWithFilters(params) {
	const query = params.toString();
	const target = query ? `${window.location.pathname}?${query}` : window.location.pathname;
	window.history.replaceState({}, '', target);
}

function renderEvents(events) {
	if (!homeElements.grid || !homeElements.emptyState) {
		return;
	}

	if (!Array.isArray(events) || events.length === 0) {
		homeElements.grid.innerHTML = '';
		homeElements.emptyState.hidden = false;
		return;
	}

	homeElements.emptyState.hidden = true;
	homeElements.grid.innerHTML = events.map(event => {
		return `
			<article class="card">
				<div class="card__title">${escapeHtml(event.title || 'Sem título')}</div>
				<p>${escapeHtml(event.description || 'Sem descrição.')}</p>
				<div class="card__meta">
					<span>${escapeHtml(event.category || 'Geral')}</span>
					<span>${escapeHtml(event.location || 'A definir')}</span>
					<span>${escapeHtml(formatDate(event.date))}</span>
				</div>
			</article>
		`;
	}).join('');
}

async function loadEvents() {
	const params = serializeFilters();
	updateUrlWithFilters(params);

	const query = params.toString();
	const endpoint = query ? `/events?${query}` : '/events';
	const response = await requestApi(endpoint);
	if (!response.ok) {
		renderEvents([]);
		return;
	}

	const events = response.data?.events;
	renderEvents(Array.isArray(events) ? events : []);
}

function initHomePage() {
	if (!homeElements.grid || !homeElements.applyFilters) {
		return;
	}

	hydrateFiltersFromUrl();
	homeElements.applyFilters.addEventListener('click', () => {
		loadEvents();
	});

	loadEvents();
}

if (page === 'login') {
	initLoginPage();
} else if (page === 'publish') {
	initPublishPage();
} else {
	initHomePage();
}