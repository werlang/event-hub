import '../css/index.css';

import { apiClient } from './helpers/api.js';
import { Toast } from './components/toast.js';
import {
    createHomeFilterParams,
    hasSpecificHomeQuery,
    readHomeFiltersFromUrl,
    syncUrlWithParams,
} from './helpers/query-state.js';
import { EventList } from './components/event-list.js';
import { FilterForm } from './components/filter-form.js';
import { QuickChips } from './components/quick-chips.js';
import { getCurrentWeekRangeLocal, getNextDaysRangeLocal } from './helpers/week-range.js';
import { Header } from './components/header.js';

new Header();

const HOME_TOAST_GROUP = 'home-status';

/**
 * Collects the home-page elements used by the client entry.
 */
function createElements() {
    return {
        entrySurface: document.querySelector('#home-entry-surface'),
        filterSurface: document.querySelector('#home-filter-surface'),
        filterForm: document.querySelector('#filter-form'),
        quickChips: document.querySelector('#quick-chips'),
        grid: document.querySelector('#events-grid'),
        filterSearch: document.querySelector('#filter-search'),
        filterCategory: document.querySelector('#filter-category'),
        filterFrom: document.querySelector('#filter-from'),
        filterTo: document.querySelector('#filter-to'),
    };
}

/**
 * Clears any visible home-page toast associated with filter feedback.
 */
function clearHomeToasts() {
    Toast.dismissGroup(HOME_TOAST_GROUP);
}

/**
 * Shows one home-page toast for transient status updates.
 */
function showHomeToast(text, tone = 'info') {
    const normalizedText = typeof text === 'string' ? text.trim() : '';
    if (!normalizedText) {
        return null;
    }

    return Toast.show(normalizedText, {
        tone,
        group: HOME_TOAST_GROUP,
        duration: tone === 'error' ? 6000 : 4800,
    });
}

/**
 * Returns the quick-filter chips displayed on the home page.
 */
function createQuickChips() {
    return [
        {
            id: 'this-week',
            label: 'Esta semana',
            buildFilters: () => getCurrentWeekRangeLocal(),
        },
        {
            id: 'next-seven-days',
            label: 'Próximos 7 dias',
            buildFilters: () => getNextDaysRangeLocal(7),
        },
        {
            id: 'category-community',
            label: 'Comunidade',
            buildFilters: () => ({ category: 'Comunidade' }),
        },
        {
            id: 'category-research',
            label: 'Pesquisa',
            buildFilters: () => ({ category: 'Pesquisa' }),
        },
        {
            id: 'category-extension',
            label: 'Extensão',
            buildFilters: () => ({ category: 'Extensão' }),
        },
    ];
}

/**
 * Shows or hides the entry surfaces when agenda-only mode is active.
 */
function setEntrySurfacesVisibility(elements, hidden) {
    if (elements.entrySurface) {
        elements.entrySurface.hidden = hidden;
    }

    if (elements.filterSurface) {
        elements.filterSurface.hidden = hidden;
    }
}

/**
 * Boots the public home page filters, chips, and event listing.
 */
export function initHomePage() {
    const elements = createElements();
    const eventList = new EventList({
        grid: elements.grid,
    });
    const filterForm = new FilterForm({
        form: elements.filterForm,
        filterSearch: elements.filterSearch,
        filterCategory: elements.filterCategory,
        filterFrom: elements.filterFrom,
        filterTo: elements.filterTo,
    });
    const quickChips = new QuickChips({ container: elements.quickChips });
    const initialFilters = readHomeFiltersFromUrl();
    const agendaOnlyMode = hasSpecificHomeQuery();

    if (!eventList.isReady() || !filterForm.isReady() || !quickChips.isReady()) {
        return;
    }

    /**
     * Loads events for the provided filters and syncs the current URL state.
     */
    const loadEvents = async (filters) => {
        clearHomeToasts();

        const params = createHomeFilterParams(filters);
        syncUrlWithParams(params);

        const query = params.toString();
        const endpoint = query ? `/events?${query}` : '/events';
        const response = await apiClient.request(endpoint);
        if (!response.ok) {
            eventList.clear();
            showHomeToast('Não foi possível carregar os eventos no momento.', 'error');
            return;
        }

        const events = Array.isArray(response.data?.events) ? response.data.events : [];
        if (events.length === 0) {
            eventList.clear();
            showHomeToast('Nenhum evento encontrado para os filtros aplicados.');
            return;
        }

        eventList.render(events);
    };

    filterForm.hydrate(initialFilters);
    quickChips.render(createQuickChips());

    filterForm.bindApply((filters) => {
        loadEvents(filters);
    });

    quickChips.bindSelect((chipFilters) => {
        const mergedFilters = {
            ...filterForm.readFilters(),
            ...chipFilters,
        };

        filterForm.hydrate(mergedFilters);
        loadEvents(mergedFilters);
    });

    setEntrySurfacesVisibility(elements, agendaOnlyMode);

    if (!agendaOnlyMode) {
        eventList.clear();
        showHomeToast('Use os filtros ou chips para carregar eventos.');
        return;
    }

    loadEvents(initialFilters);
}

initHomePage();