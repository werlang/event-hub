import '../css/week.css';

import { Header } from './components/header.js';
import { EventList } from './components/event-list.js';
import { Toast } from './components/toast.js';
import { apiClient } from './helpers/api.js';
import { TemplateVar } from './helpers/template-var.js';
import { getCurrentWeekRangeLocal } from './helpers/week-range.js';

const WEEK_TOAST_GROUP = 'week-status';

new Header();

/**
 * Collects the DOM elements required by the public week page.
 */
function createElements() {
    return {
        rangeLabel: document.querySelector('#week-range-label'),
        grid: document.querySelector('#events-grid'),
        emptyState: document.querySelector('#events-empty'),
    };
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
 * Updates the visible summary badge with the current event total.
 */
function setWeekSummary(elements, total, rangeLabel) {
    if (!elements.emptyState) {
        return;
    }

    if (!Number.isFinite(total)) {
        elements.emptyState.innerHTML = `<i class="fas fa-spinner fa-spin fa-pulse"></i> Carregando eventos...`;
        console.log(`Total de eventos nesta semana: ${total}`); // debug log
        return;
    }


    if (total === 0) {
        elements.emptyState.innerHTML = '0 eventos nesta semana';
        return;
    }

    elements.emptyState.textContent = total === 1
        ? `1 evento em ${rangeLabel}`
        : `${total} eventos em ${rangeLabel}`;
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

    if (!eventList.isReady()) {
        return;
    }

    const weekRange = readCurrentWeekRange();
    const rangeLabel = createWeekRangeLabel(weekRange);

    if (elements.rangeLabel) {
        elements.rangeLabel.textContent = rangeLabel;
    }

    setWeekSummary(elements, Number.NaN, rangeLabel);

    /**
     * Loads the current-week public event list.
     */
    async function loadWeekEvents() {
        clearWeekToasts();

        const response = await apiClient.request(createWeekEventsPath(weekRange));
        if (!response.ok) {
            eventList.clear({ showEmptyState: false });
            setWeekSummary(elements, 0, rangeLabel);
            showWeekToast('Não foi possível carregar os eventos desta semana no momento.', 'error');
            return;
        }

        const events = Array.isArray(response.data?.events) ? response.data.events : [];
        setWeekSummary(elements, events.length, rangeLabel);

        if (events.length === 0) {
            eventList.clear({
                emptyMessage: 'Nenhum evento aprovado está programado para esta semana.',
                showEmptyState: true,
            });
            return;
        }

        eventList.render(events);
    }

    loadWeekEvents();
}

initWeekPage();