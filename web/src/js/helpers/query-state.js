function cleanText(value) {
	return typeof value === 'string' ? value.trim() : '';
}

const HOME_QUERY_KEYS = ['search', 'q', 'category', 'from', 'to'];

function normalizeFilters(source = {}) {
	const params = new URLSearchParams();
	const map = {
		search: source.search,
		category: source.category,
		from: source.from,
		to: source.to,
	};

	Object.entries(map).forEach(([key, value]) => {
		const normalized = cleanText(value);
		if (normalized) {
			params.set(key, normalized);
		}
	});

	return params;
}

function hasTruthyQueryValue(params, key) {
	const value = cleanText(params.get(key));
	return Boolean(value);
}

export function hasSpecificHomeQuery(search = window.location.search) {
	const params = new URLSearchParams(search);
	return HOME_QUERY_KEYS.some((key) => hasTruthyQueryValue(params, key));
}

export function readHomeFiltersFromUrl(search = window.location.search) {
	const params = new URLSearchParams(search);
	return {
		search: params.get('search') || params.get('q') || '',
		category: params.get('category') || '',
		from: params.get('from') || '',
		to: params.get('to') || '',
	};
}

export function hydrateHomeFilters(elements) {
	if (!elements) {
		return;
	}

	const filters = readHomeFiltersFromUrl();
	if (elements.filterSearch) {
		elements.filterSearch.value = filters.search;
	}
	if (elements.filterCategory) {
		elements.filterCategory.value = filters.category;
	}
	if (elements.filterFrom) {
		elements.filterFrom.value = filters.from;
	}
	if (elements.filterTo) {
		elements.filterTo.value = filters.to;
	}
}

export function createHomeFilterParams(filters = {}) {
	return normalizeFilters(filters);
}

export function serializeHomeFilters(elements) {
	if (!elements) {
		return new URLSearchParams();
	}

	return createHomeFilterParams({
		search: elements.filterSearch?.value,
		category: elements.filterCategory?.value,
		from: elements.filterFrom?.value,
		to: elements.filterTo?.value,
	});
}

export function syncUrlWithParams(params, pathname = window.location.pathname) {
	const query = params instanceof URLSearchParams ? params.toString() : '';
	const target = query ? `${pathname}?${query}` : pathname;
	window.history.replaceState({}, '', target);
}
