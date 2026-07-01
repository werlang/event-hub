import '../css/index.css';

import { Toast } from './components/toast.js';
import {
    createHomeFilterParams,
    hasSpecificHomeQuery,
    readHomeFiltersFromUrl,
} from './helpers/query-state.js';
import { EventList } from './components/event-list.js';
import { FilterForm } from './components/filter-form.js';
import { Pagination } from './components/pagination.js';
import { QuickChips } from './components/quick-chips.js';
import { Tooltip } from './components/tooltip.js';
import { Event } from './helpers/event.js';
import { getCurrentWeekRangeLocal, getNextDaysRangeLocal } from './helpers/week-range.js';
import { Header } from './components/header.js';
import { eventApi } from './model/events.js';

new Header();

const HOME_TOAST_GROUP = 'home-status';
const HOME_EVENTS_PER_PAGE = 10;

/**
 * Collects the home-page elements used by the client entry.
 */
function createElements() {
    return {
        entrySurface: document.querySelector('#home-entry-surface'),
        filterSurface: document.querySelector('#home-filter-surface'),
        filterTooltip: document.querySelector('#home-filter-tooltip'),
        filterForm: document.querySelector('#filter-form'),
        quickChips: document.querySelector('#quick-chips'),
        grid: document.querySelector('#events-grid'),
        emptyState: document.querySelector('#events-empty'),
        pagination: document.querySelector('#home-events-pagination'),
        filterSearch: document.querySelector('#filter-search'),
        filterCategory: document.querySelector('#filter-category'),
        filterFrom: document.querySelector('#filter-from'),
        filterTo: document.querySelector('#filter-to'),
    };
}

/**
 * Mounts the longer filter guidance behind a compact tooltip cue.
 */
function mountHomeTooltips(elements) {
    if (!elements.filterTooltip) {
        return;
    }

    new Tooltip({
        element: elements.filterTooltip,
        content: 'Use os filtros para encontrar eventos de seu interesse. Você pode combinar vários filtros para refinar sua busca.',
        label: 'Ver ajuda sobre os filtros',
        placement: 'bottom',
    });
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
            id: 'today',
            label: 'Hoje',
            icon: 'calendar-day',
            buildFilters: () => getNextDaysRangeLocal(1),
        },
        {
            id: 'this-week',
            label: 'Esta semana',
            icon: 'calendar-week',
            buildFilters: () => getCurrentWeekRangeLocal(),
        },
        {
            id: 'next-seven-days',
            label: 'Próximos 7 dias',
            icon: 'calendar-days',
            buildFilters: () => getNextDaysRangeLocal(7),
        },
        {
            id: 'next-thirty-days',
            label: 'Todos Próximos',
            icon: 'infinity',
            buildFilters: () => getNextDaysRangeLocal(365),
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
    mountHomeTooltips(elements);

    const eventList = new EventList({
        grid: elements.grid,
        emptyState: elements.emptyState,
    });
    const pagination = new Pagination({
        container: elements.pagination,
        ariaLabel: 'Paginação dos eventos da agenda',
        pageSize: HOME_EVENTS_PER_PAGE,
    });
    const filterForm = new FilterForm({
        form: elements.filterForm,
        filterSearch: elements.filterSearch,
        filterCategory: elements.filterCategory,
        filterFrom: elements.filterFrom,
        filterTo: elements.filterTo,
    });
    const quickChips = new QuickChips({ container: elements.quickChips });
    const initialFilters = readHomeFiltersFromUrl(window.location.search);
    const agendaOnlyMode = hasSpecificHomeQuery();
    let currentPage = 1;
    let loadedEvents = [];

    if (!eventList.isReady() || !filterForm.isReady() || !quickChips.isReady()) {
        return;
    }

    pagination.onPageChange(({ page }) => {
        if (page === currentPage) {
            return;
        }

        currentPage = pagination.clampPage(page, loadedEvents);
        renderCurrentPage();
        elements.grid?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    /**
     * Renders the current home-event slice and updates the shared pager.
     */
    const renderCurrentPage = () => {
        if (loadedEvents.length === 0) {
            eventList.clear();
            pagination.render({ items: loadedEvents, currentPage: 1 });
            return;
        }

        currentPage = pagination.clampPage(currentPage, loadedEvents);
        eventList.render(pagination.readPageItems(loadedEvents, currentPage));
        pagination.render({ items: loadedEvents, currentPage });
    };

    /**
     * Loads events for the provided filters and syncs the current URL state.
     */
    const loadEvents = async (filters) => {
        clearHomeToasts();

        const params = createHomeFilterParams(filters);

        const response = await eventApi.listPublic(params);
        if (!response.ok) {
            loadedEvents = [];
            currentPage = 1;
            eventList.clear({ showEmptyState: false });
            pagination.render({ items: loadedEvents, currentPage });
            showHomeToast('Não foi possível carregar os eventos no momento.', 'error');
            return;
        }

        loadedEvents = Event.sortByDate(Array.isArray(response.data?.events) ? response.data.events : []);
        currentPage = 1;

        if (loadedEvents.length === 0) {
            renderCurrentPage();
            showHomeToast('Nenhum evento encontrado para os filtros aplicados.');
            return;
        }

        renderCurrentPage();
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

    loadEvents(initialFilters);
}

initHomePage();
