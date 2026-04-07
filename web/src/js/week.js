import '../css/week.css';

import { Header } from './components/header.js';
import { EventList } from './components/event-list.js';
import { Pagination } from './components/pagination.js';
import { Toast } from './components/toast.js';
import { Tooltip } from './components/tooltip.js';
import { apiClient } from './helpers/api.js';
import { TemplateVar } from './helpers/template-var.js';
import { getCurrentWeekRangeLocal } from './helpers/week-range.js';

const WEEK_TOAST_GROUP = 'week-status';
const WEEK_EVENTS_PER_PAGE = 10;

new Header();

/**
 * Collects the DOM elements required by the public week page.
 */
function createElements() {
    return {
        rangeLabel: document.querySelector('#week-range-label'),
        calendarTooltip: document.querySelector('#week-calendar-tooltip'),
        grid: document.querySelector('#events-grid'),
        emptyState: document.querySelector('#events-empty'),
        pagination: document.querySelector('#week-events-pagination'),
    };
}

/**
 * Mounts the compact help cue for the Google Calendar action.
 */
function mountWeekTooltips(elements) {
    if (!elements.calendarTooltip) {
        return;
    }

    new Tooltip({
        element: elements.calendarTooltip,
        label: 'Ver ajuda sobre o botão do Google Calendar',
        placement: 'bottom',
        useHostTrigger: true,
    });
}

/**
 * Clears any status toast currently visible for the week page.
 */
function clearWeekToasts() {
    Toast.dismissGroup(WEEK_TOAST_GROUP);
}

/**
 * Shows one transient status toast for the week page.
 */
function showWeekToast(text, tone = 'info') {
    const normalizedText = typeof text === 'string' ? text.trim() : '';
    if (!normalizedText) {
        return null;
    }

    return Toast.show(normalizedText, {
        tone,
        group: WEEK_TOAST_GROUP,
        duration: tone === 'error' ? 6000 : 4800,
    });
}

/**
 * Formats one YYYY-MM-DD value using the public pt-BR long-date style.
 */
function formatCalendarDatePtBr(value) {
    const [yearText, monthText, dayText] = String(value || '').split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);

    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
        return '';
    }

    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date(year, month - 1, day));
}

/**
 * Builds the user-facing label for the current week interval.
 */
function createWeekRangeLabel({ from, to }) {
    const fromLabel = formatCalendarDatePtBr(from);
    const toLabel = formatCalendarDatePtBr(to);

    return fromLabel && toLabel
        ? `${fromLabel} a ${toLabel}`
        : 'Semana atual';
}

/**
 * Reads the server-provided week range, falling back to the current local week.
 */
function readCurrentWeekRange() {
    const fallbackRange = getCurrentWeekRangeLocal();
    const from = TemplateVar.get('weekFrom');
    const to = TemplateVar.get('weekTo');

    return {
        from: typeof from === 'string' && from ? from : fallbackRange.from,
        to: typeof to === 'string' && to ? to : fallbackRange.to,
    };
}

/**
 * Creates the public API path used to load the approved weekly event list.
 */
function createWeekEventsPath({ from, to }) {
    const params = new URLSearchParams({ from, to });
    return `/events?${params.toString()}`;
}

/**
 * Boots the standalone public current-week page.
 */
export function initWeekPage() {
    const elements = createElements();
    const eventList = new EventList({
        grid: elements.grid,
        emptyState: elements.emptyState,
    });
    const pagination = new Pagination({
        container: elements.pagination,
        ariaLabel: 'Paginação dos eventos da semana',
        pageSize: WEEK_EVENTS_PER_PAGE,
    });
    let currentPage = 1;
    let loadedEvents = [];

    if (!eventList.isReady()) {
        return;
    }

    mountWeekTooltips(elements);

    const weekRange = readCurrentWeekRange();
    const rangeLabel = createWeekRangeLabel(weekRange);

    if (elements.rangeLabel) {
        elements.rangeLabel.innerHTML = `<i class="fas fa-calendar-week"></i> ${rangeLabel}`;
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
     * Renders the current page of weekly events and updates the pager.
     */
    function renderCurrentPage() {
        if (loadedEvents.length === 0) {
            eventList.clear({
                emptyMessage: 'Nenhum evento aprovado está programado para esta semana.',
                showEmptyState: true,
            });
            pagination.render({ items: loadedEvents, currentPage });
            return;
        }

        currentPage = pagination.clampPage(currentPage, loadedEvents);
        eventList.render(pagination.readPageItems(loadedEvents, currentPage));
        pagination.render({ items: loadedEvents, currentPage });
    }

    /**
     * Loads the current-week public event list.
     */
    async function loadWeekEvents() {
        clearWeekToasts();

        const response = await apiClient.request(createWeekEventsPath(weekRange));
        if (!response.ok) {
            eventList.clear({ showEmptyState: false });
            pagination.render({ items: [], currentPage: 1 });
            showWeekToast('Não foi possível carregar os eventos desta semana no momento.', 'error');
            return;
        }

        loadedEvents = Array.isArray(response.data?.events) ? response.data.events : [];
        currentPage = 1;
        renderCurrentPage();
    }

    loadWeekEvents();
}

initWeekPage();