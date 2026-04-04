import { BaseComponent } from '../components/base-component.js';
import { Event } from '../helpers/event.js';

export const DASHBOARD_FILTER_ALL = 'all';
export const DASHBOARD_FILTER_ASC = 'asc';
export const DASHBOARD_FILTER_DESC = 'desc';

/**
 * Returns a safe user-facing text fallback.
 */
function readText(value, fallback) {
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    return normalizedValue || fallback;
}

/**
 * Returns the default browse-filter state used by the dashboard list.
 */
export function createDefaultDashboardBrowseFilters() {
    return {
        status: DASHBOARD_FILTER_ALL,
        category: DASHBOARD_FILTER_ALL,
        includePast: false,
        order: DASHBOARD_FILTER_DESC,
    };
}

/**
 * Normalizes one browse-list status filter value.
 */
export function normalizeDashboardStatusFilter(value) {
    const normalizedValue = String(value || DASHBOARD_FILTER_ALL).trim().toLowerCase();
    const allowedValues = [DASHBOARD_FILTER_ALL, 'pending', 'rejected', 'published'];

    return allowedValues.includes(normalizedValue)
        ? normalizedValue
        : DASHBOARD_FILTER_ALL;
}

/**
 * Normalizes one browse-list ordering value.
 */
export function normalizeDashboardSortOrder(value) {
    return String(value || DASHBOARD_FILTER_DESC).trim().toLowerCase() === DASHBOARD_FILTER_ASC
        ? DASHBOARD_FILTER_ASC
        : DASHBOARD_FILTER_DESC;
}

/**
 * Returns the canonical category metadata for one dashboard event.
 */
function readDashboardEventCategory(event) {
    return Event.from(event).readCategoryMeta();
}

/**
 * Returns the category options available for the loaded owner events.
 */
function readDashboardEventCategoryOptions(events) {
    const options = [];
    const seenCategories = new Set();

    (Array.isArray(events) ? events : []).forEach((event) => {
        const category = readDashboardEventCategory(event);
        const optionValue = String(category?.id || '').trim().toLowerCase();

        if (!optionValue || seenCategories.has(optionValue)) {
            return;
        }

        seenCategories.add(optionValue);
        options.push({
            value: optionValue,
            label: readText(category?.label, 'Outro'),
        });
    });

    return options.sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'));
}

/**
 * Synchronizes the current browse-filter state with the available events.
 */
export function syncDashboardBrowseFilters(events, filters = {}) {
    const categoryOptions = readDashboardEventCategoryOptions(events);
    const nextFilters = {
        ...createDefaultDashboardBrowseFilters(),
        ...(filters && typeof filters === 'object' ? filters : {}),
    };
    const selectedCategory = readText(nextFilters.category, DASHBOARD_FILTER_ALL).toLowerCase();
    const hasSelectedCategory = selectedCategory === DASHBOARD_FILTER_ALL
        || categoryOptions.some(option => option.value === selectedCategory);

    if (!hasSelectedCategory) {
        nextFilters.category = DASHBOARD_FILTER_ALL;
    }

    nextFilters.status = normalizeDashboardStatusFilter(nextFilters.status);
    nextFilters.category = readText(nextFilters.category, DASHBOARD_FILTER_ALL).toLowerCase();
    nextFilters.order = normalizeDashboardSortOrder(nextFilters.order);
    nextFilters.includePast = Boolean(nextFilters.includePast);

    return nextFilters;
}

/**
 * Reports whether the browse list currently deviates from the default criteria.
 */
function hasActiveDashboardBrowseFilters(filters) {
    return normalizeDashboardStatusFilter(filters?.status) !== DASHBOARD_FILTER_ALL
        || readText(filters?.category, DASHBOARD_FILTER_ALL).toLowerCase() !== DASHBOARD_FILTER_ALL
        || Boolean(filters?.includePast)
        || normalizeDashboardSortOrder(filters?.order) !== DASHBOARD_FILTER_DESC;
}

/**
 * Returns the owner-event list after applying the current browse filters.
 */
export function filterDashboardBrowseEvents(events, filters) {
    const normalizedFilters = syncDashboardBrowseFilters(events, filters);
    const normalizedStatus = normalizedFilters.status;
    const normalizedCategory = normalizedFilters.category;
    const includePast = normalizedFilters.includePast;
    const normalizedOrder = normalizedFilters.order;

    const filteredEvents = (Array.isArray(events) ? events : []).filter((event) => {
        const eventStatus = String(event?.status || '').trim().toLowerCase();
        const eventCategory = readDashboardEventCategory(event).id;

        if (normalizedStatus !== DASHBOARD_FILTER_ALL && eventStatus !== normalizedStatus) {
            return false;
        }

        if (normalizedCategory !== DASHBOARD_FILTER_ALL && eventCategory !== normalizedCategory) {
            return false;
        }

        if (!includePast && Event.from(event).isPast()) {
            return false;
        }

        return true;
    });

    return normalizedOrder === DASHBOARD_FILTER_ASC
        ? Event.sortByDate(filteredEvents)
        : Event.sortByDateDescending(filteredEvents);
}

/**
 * Formats the events badge shown above the browse list.
 */
export function formatDashboardBrowseBadge(filteredCount, totalCount) {
    if (filteredCount === totalCount) {
        return `${totalCount} ${totalCount === 1 ? 'evento' : 'eventos'}`;
    }

    return `${filteredCount} de ${totalCount} ${totalCount === 1 ? 'evento' : 'eventos'}`;
}

/**
 * Returns the browse-list caption associated with the current filters.
 */
export function readDashboardBrowseCaption(filteredCount, totalCount, filters, sectionCopy) {
    if (totalCount === 0) {
        return sectionCopy.emptyCaption;
    }

    if (!hasActiveDashboardBrowseFilters(filters)) {
        return filteredCount > 0
            ? sectionCopy.populatedCaption
            : sectionCopy.emptyCaption;
    }

    if (filteredCount === 0) {
        return 'Nenhum evento corresponde aos filtros aplicados agora.';
    }

    return filteredCount === totalCount
        ? 'Os filtros atuais mantiveram todos os seus eventos visíveis.'
        : 'Os filtros atuais ajustaram a lista para destacar apenas os eventos que combinam com os critérios escolhidos.';
}

/**
 * Returns the empty-state copy shown when the browse list has no visible events.
 */
export function readDashboardBrowseEmptyState(filteredCount, totalCount, filters, sectionCopy) {
    if (totalCount === 0) {
        return sectionCopy.emptyState;
    }

    if (filteredCount === 0 && !Boolean(filters?.includePast) && !hasActiveDashboardBrowseFilters(filters)) {
        return 'Não há eventos futuros ou em andamento agora. Marque a opção para incluir eventos passados na lista.';
    }

    if (filteredCount === 0 && hasActiveDashboardBrowseFilters(filters)) {
        return 'Nenhum evento se encaixou nos filtros escolhidos. Ajuste os critérios para ampliar a busca.';
    }

    return sectionCopy.emptyState;
}

/**
 * Builds one select option for the dashboard browse filters.
 */
function createDashboardSelectOption({ value, label, selected = false } = {}) {
    const option = document.createElement('option');
    option.value = readText(value, DASHBOARD_FILTER_ALL).toLowerCase();
    option.textContent = readText(label, 'Todas as categorias');
    option.selected = Boolean(selected);
    return option;
}

/**
 * Controls the dashboard browse-filter form.
 */
export class DashboardFilters extends BaseComponent {
    #fields;
    #onChange;

    /**
     * Creates the dashboard browse-filter controller.
     */
    constructor({ root = null, statusField = null, categoryField = null, showPastField = null, orderField = null, onChange = null } = {}) {
        super(root || statusField?.closest('.dashboard-events-filters') || null);
        this.#fields = {
            status: statusField,
            category: categoryField,
            includePast: showPastField,
            order: orderField,
        };
        this.#onChange = typeof onChange === 'function' ? onChange : null;
    }

    /**
     * Reports whether the filter component has all required controls.
     */
    isReady() {
        return super.isReady()
            && Object.values(this.#fields).every(Boolean);
    }

    /**
     * Wires change handling for the dashboard browse filters.
     */
    wire() {
        if (!super.isReady()) {
            return this;
        }

        this.destroy();
        this.on(this.get(), 'change', (event) => {
            this.#handleChange(event);
        });
        return this;
    }

    /**
     * Reads the current filter values from the DOM controls.
     */
    readFilters() {
        return syncDashboardBrowseFilters([], {
            status: this.#fields.status?.value,
            category: this.#fields.category?.value,
            includePast: this.#fields.includePast?.checked,
            order: this.#fields.order?.value,
        });
    }

    /**
     * Synchronizes the filter DOM with the current browse state.
     */
    render({ events = [], filters = createDefaultDashboardBrowseFilters(), hidden = false } = {}) {
        const normalizedFilters = syncDashboardBrowseFilters(events, filters);

        this.setHidden(hidden);

        if (!this.isReady()) {
            return normalizedFilters;
        }

        this.#syncCategoryOptions(events, normalizedFilters);
        this.#fields.status.value = normalizedFilters.status;
        this.#fields.category.value = normalizedFilters.category;
        this.#fields.includePast.checked = normalizedFilters.includePast;
        this.#fields.order.value = normalizedFilters.order;
        return normalizedFilters;
    }

    /**
     * Handles DOM changes emitted by one dashboard browse filter.
     */
    #handleChange(domEvent) {
        const target = domEvent.target instanceof HTMLInputElement || domEvent.target instanceof HTMLSelectElement
            ? domEvent.target
            : null;

        if (!target || !this.get()?.contains(target)) {
            return;
        }

        this.#onChange?.(this.readFilters(), domEvent, this);
    }

    /**
     * Rebuilds the category select options from the loaded owner events.
     */
    #syncCategoryOptions(events, filters) {
        const categoryField = this.#fields.category;

        if (!categoryField) {
            return;
        }

        const categoryOptions = readDashboardEventCategoryOptions(events);
        const fragment = document.createDocumentFragment();
        fragment.appendChild(createDashboardSelectOption({
            value: DASHBOARD_FILTER_ALL,
            label: 'Todas as categorias',
            selected: filters.category === DASHBOARD_FILTER_ALL,
        }));

        categoryOptions.forEach((option) => {
            fragment.appendChild(createDashboardSelectOption({
                value: option.value,
                label: option.label,
                selected: option.value === filters.category,
            }));
        });

        categoryField.replaceChildren(fragment);
    }
}

export default DashboardFilters;