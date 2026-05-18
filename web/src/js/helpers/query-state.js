import { getCurrentWeekRangeLocal, normalizeInclusiveEndDateTime } from './week-range.js';

/**
 * Normalizes a possible query-string value into trimmed text.
 */
function cleanText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

const HOME_QUERY_KEYS = ['search', 'q', 'category', 'from', 'to'];

/**
 * Returns the default home-page filter state.
 */
export function createDefaultHomeFilters(referenceDate = new Date()) {
    return {
        search: '',
        category: '',
        ...getCurrentWeekRangeLocal(referenceDate),
    };
}

/**
 * Normalizes a fallback filter source used when the URL omits the date range.
 */
function normalizeDefaultHomeFilters(fallbackFilters = createDefaultHomeFilters()) {
    return {
        search: '',
        category: '',
        from: cleanText(fallbackFilters.from),
        to: cleanText(fallbackFilters.to),
    };
}

/**
 * Applies the default date window when the URL does not provide one.
 */
function withDefaultHomeDateRange(filters, fallbackFilters = createDefaultHomeFilters()) {
    const nextFilters = filters && typeof filters === 'object' ? filters : {};
    const defaultFilters = normalizeDefaultHomeFilters(fallbackFilters);
    const hasExplicitDateRange = Boolean(cleanText(nextFilters.from) || cleanText(nextFilters.to));

    return {
        search: cleanText(nextFilters.search),
        category: cleanText(nextFilters.category),
        from: hasExplicitDateRange ? cleanText(nextFilters.from) : defaultFilters.from,
        to: hasExplicitDateRange ? cleanText(nextFilters.to) : defaultFilters.to,
    };
}

/**
 * Builds URLSearchParams from the supported home page filters.
 */
function normalizeFilters(source = {}) {
    const params = new URLSearchParams();
    const map = {
        search: source.search,
        category: source.category,
        from: source.from,
        to: normalizeInclusiveEndDateTime(source.to),
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
export function readHomeFiltersFromUrl(
    search = window.location.search,
    fallbackFilters = createDefaultHomeFilters(),
) {
    const params = new URLSearchParams(search);
    return withDefaultHomeDateRange({
        search: params.get('search') || params.get('q') || '',
        category: params.get('category') || '',
        from: params.get('from') || '',
        to: params.get('to') || '',
    }, fallbackFilters);
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