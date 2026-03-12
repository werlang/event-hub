/**
 * Normalizes a possible query-string value into trimmed text.
 */
function cleanText(value) {
	return typeof value === 'string' ? value.trim() : '';
}

const HOME_QUERY_KEYS = ['search', 'q', 'category', 'from', 'to'];

/**
 * Builds URLSearchParams from the supported home page filters.
 */
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

/**
 * Checks whether a query parameter contains a truthy value.
 */
function hasTruthyQueryValue(params, key) {
	const value = cleanText(params.get(key));
	return Boolean(value);
}

/**
 * Reports whether the current URL contains home filter state.
 */
export function hasSpecificHomeQuery(search = window.location.search) {
	const params = new URLSearchParams(search);
	return HOME_QUERY_KEYS.some((key) => hasTruthyQueryValue(params, key));
}

/**
 * Reads supported home filters from a URL query string.
 */
export function readHomeFiltersFromUrl(search = window.location.search) {
	const params = new URLSearchParams(search);
	return {
		search: params.get('search') || params.get('q') || '',
		category: params.get('category') || '',
		from: params.get('from') || '',
		to: params.get('to') || '',
	};
}

/**
 * Hydrates plain DOM filter inputs from the current home URL state.
 */
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

/**
 * Creates URLSearchParams for the supported home filters.
 */
export function createHomeFilterParams(filters = {}) {
	return normalizeFilters(filters);
}

/**
 * Serializes DOM filter inputs into URLSearchParams.
 */
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

/**
 * Replaces the current URL with the provided filter params.
 */
export function syncUrlWithParams(params, pathname = window.location.pathname) {
	const query = params instanceof URLSearchParams ? params.toString() : '';
	const target = query ? `${pathname}?${query}` : pathname;
	window.history.replaceState({}, '', target);
}
