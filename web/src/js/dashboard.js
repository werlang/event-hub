import '../css/dashboard.css';

import { BaseComponent } from './components/base-component.js';
import { Header } from './components/header.js';
import { DashboardEventFormModal } from './dashboard/create-event-modal.js';
import { DashboardDeleteEventModal } from './dashboard/delete-event-modal.js';
import { canManageOwnEvent } from './dashboard/event-management.js';
import { DashboardSettingsModal } from './dashboard/settings-modal.js';
import { Toast } from './components/toast.js';
import { Tooltip } from './components/tooltip.js';
import { requestApi } from './helpers/api.js';
import { formatDateTimePtBr } from './helpers/date-format.js';
import { isPastEvent, sortEventsByDateDescending } from './helpers/event-sort.js';
import { readEventTagSummary } from './helpers/event-category.js';
import { createLocationContent } from './helpers/location-link.js';

const DASHBOARD_STATUS_TOAST_GROUP = 'dashboard-status';
const DASHBOARD_HIDDEN_CLASS = 'dashboard-empty-state--hidden';

/**
 * Returns the UI metadata associated with an event moderation status.
 */
function readStatusMeta(status) {
    const normalizedStatus = String(status || 'pending').trim().toLowerCase();

    if (normalizedStatus === 'published') {
        return {
            label: 'Publicado',
            tone: 'success',
            note: 'Este evento já está visível na agenda pública.',
            icon: 'check',
        };
    }

    if (normalizedStatus === 'rejected') {
        return {
            label: 'Rejeitado',
            tone: 'warning',
            note: 'Este envio precisa de ajustes antes de voltar para aprovação.',
            icon: 'exclamation',
        };
    }

    return {
        label: 'Pendente',
        tone: 'pending',
        note: 'Este envio ainda está aguardando aprovação.',
        icon: 'clock',
    };
}

/**
 * Returns a localized label for the authenticated account role.
 */
function readRoleLabel(role) {
    return String(role || '').trim().toLowerCase() === 'admin'
        ? 'Administrador'
        : 'Membro';
}

/**
 * Returns a safe user-facing text fallback.
 */
function readText(value, fallback) {
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    return normalizedValue || fallback;
}

/**
 * Formats an event count with singular/plural agreement.
 */
function formatCount(total, singular, plural) {
    return `${total} ${total === 1 ? singular : plural}`;
}

/**
 * Counts events matching a predicate without assuming a valid array input.
 */
function countEvents(events, predicate) {
    if (!Array.isArray(events) || typeof predicate !== 'function') {
        return 0;
    }

    return events.filter(predicate).length;
}

/**
 * Reports whether an event is current or upcoming for dashboard summary purposes.
 */
function isUpcomingEvent(event) {
    return Boolean(event?.date) && !isPastEvent(event);
}

/**
 * Builds the dashboard summary-card model from the current event list.
 */
function createSummaryCards(events) {
    const total = Array.isArray(events) ? events.length : 0;
    const pending = countEvents(events, event => readStatusMeta(event?.status).tone === 'pending');
    const published = countEvents(events, event => readStatusMeta(event?.status).tone === 'success');
    const rejected = countEvents(events, event => readStatusMeta(event?.status).tone === 'warning');
    const upcoming = countEvents(events, isUpcomingEvent);

    return [
        {
            id: 'submitted',
            label: 'Enviados',
            value: total,
            note: 'Eventos já cadastrados pela sua conta.',
            tone: 'main',
        },
        {
            id: 'pending',
            label: 'Pendentes',
            value: pending,
            note: 'Aguardando validação da moderação.',
            tone: 'pending',
        },
        {
            id: 'published',
            label: 'Publicados',
            value: published,
            note: 'Eventos já exibidos na agenda pública.',
            tone: 'success',
        },
        {
            id: 'rejected',
            label: 'Rejeitados',
            value: rejected,
            note: 'Envios que pedem revisão antes de voltar.',
            tone: 'warning',
        },
        {
            id: 'upcoming',
            label: 'Próximos',
            value: upcoming,
            note: 'Eventos cuja data ainda não passou.',
            tone: 'neutral',
        },
    ];
}

/**
 * Creates one summary-card DOM node for the overview section.
 */
function createSummaryCardElement(card) {
    const element = document.createElement('article');
    element.className = `dashboard-summary-card dashboard-summary-card--${card.tone}`;

    const label = document.createElement('span');
    label.className = 'dashboard-summary-card__label';
    label.textContent = card.label;

    const value = document.createElement('strong');
    value.className = 'dashboard-summary-card__value';
    value.textContent = String(card.value);

    const note = document.createElement('p');
    note.className = 'dashboard-summary-card__note';
    note.textContent = card.note;

    element.append(label, value, note);
    return element;
}

/**
 * Creates a metadata pill used by dashboard event cards.
 */
function createMetaPill(content, modifier = '') {
    const pill = document.createElement('span');
    pill.className = modifier
        ? `dashboard-meta-pill dashboard-meta-pill--${modifier}`
        : 'dashboard-meta-pill';

    if (typeof modifier === 'string' && modifier.trim()) {
        const iconElement = document.createElement('i');

        if (modifier === 'category') {
            iconElement.classList.add('fa-solid', 'fa-tag');
        } else if (modifier === 'date') {
            iconElement.classList.add('fa-solid', 'fa-calendar-days');
        } else {
            iconElement.classList.add('fa-solid', 'fa-location-dot');
        }

        iconElement.setAttribute('aria-hidden', 'true');
        pill.appendChild(iconElement);
    }

    pill.appendChild(content);
    return pill;
}

/**
 * Creates the compact category summary shown in dashboard event metadata.
 */
function createCategoryMetaContent(event) {
    const summary = readEventTagSummary(event, { visibleCount: 1 });
    const label = summary.visibleTags[0]?.label || 'Outro';
    const content = document.createElement('span');
    content.textContent = summary.hiddenCount > 0 ? `${label} +${summary.hiddenCount}` : label;

    if (summary.hiddenCount > 0) {
        content.title = summary.hiddenTags.map(tag => tag.label).join(', ');
    }

    return content;
}

/**
 * Creates one dashboard action button for manageable event cards.
 */
function createEventActionButton({ action, label, icon, modifier = '' } = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.dashboardAction = readText(action, '');
    button.className = modifier
        ? `button button--ghost dashboard-event__action-button dashboard-event__action-button--${modifier}`
        : 'button button--ghost dashboard-event__action-button';

    if (typeof icon === 'string' && icon.trim()) {
        const iconElement = document.createElement('i');
        iconElement.classList.add('fa-solid', `fa-${icon.trim()}`);
        iconElement.setAttribute('aria-hidden', 'true');
        button.appendChild(iconElement);
    }

    const labelElement = document.createElement('span');
    labelElement.textContent = readText(label, 'Continuar');
    button.appendChild(labelElement);
    return button;
}

/**
 * Returns the longer action guidance associated with one dashboard event card.
 */
function readActionHintText(statusMeta) {
    return statusMeta.tone === 'warning'
        ? 'Faça os ajustes necessários e reenvie o evento para moderação, ou exclua este envio se preferir começar de novo.'
        : 'Enquanto este envio não for publicado, você ainda pode editar ou excluir os dados.';
}

/**
 * Creates a compact help cue that reveals the longer event action guidance.
 */
function createEventActionGuide(statusMeta) {
    const guide = document.createElement('div');
    guide.className = 'dashboard-event__action-guide';

    const tooltip = new Tooltip({
        content: readActionHintText(statusMeta),
        label: 'Ver orientações deste envio',
        customClass: 'dashboard-event__action-tooltip',
    });

    guide.append(tooltip.get());
    return guide;
}

/**
 * Creates a rendered event card tailored for the dashboard list.
 */
function createDashboardEventElement(event) {
    const statusMeta = readStatusMeta(event?.status);
    const isManageable = canManageOwnEvent(event);
    const article = document.createElement('article');
    article.className = `dashboard-event dashboard-event--${statusMeta.tone}`;
    article.dataset.eventId = readText(event?.id, '');

    if (isPastEvent(event)) {
        article.classList.add('dashboard-event--past');
    }

    const header = document.createElement('div');
    header.className = 'dashboard-event__header';

    const title = document.createElement('h3');
    title.className = 'dashboard-event__title';
    title.textContent = readText(event?.title, 'Evento sem título');

    const statusGroup = document.createElement('div');
    statusGroup.className = 'dashboard-event__status-group';

    const tooltipPending = new Tooltip({
        content: statusMeta.note,
        label: `Status: ${statusMeta.label}`,
        icon: statusMeta.icon,
    });

    const statusPill = document.createElement('span');
    statusPill.className = `dashboard-status-pill dashboard-status-pill--${statusMeta.tone}`;
    statusPill.append(tooltipPending.get(), statusMeta.label);
    statusGroup.appendChild(statusPill);

    const tooltipTimeline = new Tooltip({
        content: isPastEvent(event) ? 'Este evento já ocorreu.' : 'Este evento ainda vai acontecer.',
        label: `Timeline: ${isPastEvent(event) ? 'Passado' : 'Próximo'}`,
        icon: isPastEvent(event) ? 'clock-rotate-left' : 'clock',
    });

    const timelinePill = document.createElement('span');
    timelinePill.className = 'dashboard-status-pill dashboard-status-pill--neutral';
    timelinePill.append(tooltipTimeline.get(), isPastEvent(event) ? 'Passado' : 'Próximo');
    statusGroup.appendChild(timelinePill);

    header.append(title, statusGroup);

    const description = document.createElement('p');
    description.className = 'dashboard-event__description';
    description.textContent = readText(event?.description, 'Sem descrição.');

    const meta = document.createElement('div');
    meta.className = 'dashboard-event__meta';
    meta.append(
        createMetaPill(createCategoryMetaContent(event), 'category'),
        createMetaPill(createLocationContent(event?.location, {
            fallback: 'A definir',
            linkClass: 'dashboard-meta-pill__link',
        }), 'location'),
        createMetaPill(document.createTextNode(formatDateTimePtBr(event?.date)), 'date'),
    );

    article.append(header, description, meta);

    if (isManageable) {
        const footer = document.createElement('div');
        footer.className = 'dashboard-event__footer';

        const actions = document.createElement('div');
        actions.className = 'dashboard-event__actions';
        actions.append(
            createEventActionButton({
                action: 'edit',
                label: 'Editar',
                icon: 'pen-to-square',
                modifier: 'edit',
            }),
            createEventActionButton({
                action: 'delete',
                label: 'Excluir',
                icon: 'trash',
                modifier: 'danger',
            }),
        );

        footer.append(createEventActionGuide(statusMeta), actions);
        article.appendChild(footer);
    }

    return article;
}

class DashboardPage extends BaseComponent {
    #elements;
    #events = [];
    #eventFormModal;
    #deleteEventModal;
    #session = null;
    #settingsModal;

    /**
     * Creates the dashboard page controller around the page root.
     */
    constructor() {
        super(document.querySelector('#dashboard-root'));
        this.#elements = this.#collectElements();
        this.#eventFormModal = new DashboardEventFormModal({
            trigger: this.#elements.createToggle,
        });
        this.#eventFormModal.onSubmitSuccess(async ({ event, mode, previousEventId }) => {
            await this.#syncEventsAfterSubmit({ event, mode, previousEventId });
        });
        this.#deleteEventModal = new DashboardDeleteEventModal();
        this.#deleteEventModal.onDeleteSuccess(async ({ eventId }) => {
            await this.#syncEventsAfterDelete(eventId);
        });
        this.#settingsModal = new DashboardSettingsModal({
            trigger: this.#elements.settingsButton,
        });

        this.on(this.#elements.eventsList, 'click', event => {
            void this.#handleEventListClick(event);
        });

        this.#elements.eventsEmpty?.classList.add(DASHBOARD_HIDDEN_CLASS);
    }

    /**
     * Boots the dashboard page once the required DOM is present.
     */
    async init() {
        if (!this.#isReady()) {
            return;
        }

        const header = new Header(true);
        const session = await header.getSession();
        if (!session) {
            return;
        }

        if (!session.isAuthenticated) {
            if (!['missing-token', 'invalid-token'].includes(session.reason)) {
                this.#showToast(
                    session.message || 'Não foi possível validar a sua sessão agora.',
                    'error',
                    { group: DASHBOARD_STATUS_TOAST_GROUP },
                );
            }
            return;
        }

        this.#session = session;
    this.#eventFormModal.setSession(session);
    this.#deleteEventModal.setSession(session);
        this.#settingsModal.setUser(session.user);
        Toast.dismissGroup(DASHBOARD_STATUS_TOAST_GROUP);
        this.#renderHeader();
        await this.refreshEvents();
    }

    /**
     * Reloads the current user's events and refreshes every dashboard section.
     */
    async refreshEvents() {
        if (!this.#session?.token) {
            return;
        }

        Toast.dismissGroup(DASHBOARD_STATUS_TOAST_GROUP);

        const response = await requestApi('/events/mine', {
            token: this.#session.token,
        });

        if (!response.ok) {
            this.#events = [];
            this.#renderDashboardSections();
            this.#showToast(
                response.message || 'Não foi possível carregar os seus eventos no momento.',
                'error',
                { group: DASHBOARD_STATUS_TOAST_GROUP },
            );
            return;
        }

        this.#events = sortEventsByDateDescending(response.data?.events || []);
        this.#renderDashboardSections();
    }

    /**
     * Collects the DOM elements used throughout the dashboard lifecycle.
     */
    #collectElements() {
        const root = this.get();

        return {
            root,
            roleChip: root?.querySelector('#dashboard-role-chip') || null,
            overviewBadge: root?.querySelector('#dashboard-overview-badge') || null,
            overviewNote: root?.querySelector('#dashboard-overview-note') || null,
            summaryGrid: root?.querySelector('#dashboard-summary-grid') || null,
            eventsSection: root?.querySelector('#dashboard-events-section') || null,
            eventsBadge: root?.querySelector('#dashboard-events-badge') || null,
            eventsCaption: root?.querySelector('#dashboard-events-caption') || null,
            eventsList: root?.querySelector('#dashboard-events-list') || null,
            eventsEmpty: root?.querySelector('#dashboard-events-empty') || null,
            actionsSection: root?.querySelector('#dashboard-actions-section') || null,
            actionsBadge: root?.querySelector('#dashboard-actions-badge') || null,
            createToggle: root?.querySelector('#dashboard-create-toggle') || null,
            settingsButton: root?.querySelector('#dashboard-settings-button') || null,
        };
    }

    /**
     * Reports whether the dashboard has every required element to boot.
     */
    #isReady() {
        return Boolean(
            super.isReady()
            && this.#elements.summaryGrid
            && this.#elements.eventsList
            && this.#elements.eventsEmpty
            && this.#elements.createToggle
            && this.#elements.settingsButton,
        );
    }

    /**
     * Looks up one event by id inside the current dashboard state.
     */
    #findEventById(eventId) {
        const normalizedEventId = readText(eventId, '');
        return this.#events.find(event => event.id === normalizedEventId) || null;
    }

    /**
     * Synchronizes dashboard sections after the create or edit modal succeeds.
     */
    async #syncEventsAfterSubmit({ event, mode, previousEventId } = {}) {
        if (!event?.id) {
            await this.refreshEvents();
            return;
        }

        const normalizedMode = readText(mode, 'create').toLowerCase();
        const nextEvents = this.#events.filter((currentEvent) => {
            if (normalizedMode === 'edit' && previousEventId) {
                return currentEvent.id !== previousEventId;
            }

            return currentEvent.id !== event.id;
        });

        this.#events = sortEventsByDateDescending([event, ...nextEvents]);
        this.#renderDashboardSections();

        if (this.#elements.eventsSection) {
            this.#elements.eventsSection.open = true;
        }
    }

    /**
     * Synchronizes dashboard sections after a successful delete action.
     */
    async #syncEventsAfterDelete(eventId) {
        const normalizedEventId = readText(eventId, '');
        if (!normalizedEventId) {
            await this.refreshEvents();
            return;
        }

        this.#events = this.#events.filter(event => event.id !== normalizedEventId);
        this.#renderDashboardSections();

        if (this.#elements.eventsSection) {
            this.#elements.eventsSection.open = true;
        }
    }

    /**
     * Handles edit and delete clicks dispatched from the event list.
     */
    async #handleEventListClick(domEvent) {
        const actionButton = domEvent.target instanceof Element
            ? domEvent.target.closest('[data-dashboard-action]')
            : null;

        if (!actionButton || !this.#elements.eventsList?.contains(actionButton)) {
            return;
        }

        const requestedAction = readText(actionButton.dataset.dashboardAction, '');
        const eventCard = actionButton.closest('[data-event-id]');
        const managedEvent = this.#findEventById(eventCard?.dataset.eventId);

        if (!managedEvent) {
            return;
        }

        if (!canManageOwnEvent(managedEvent)) {
            this.#showToast(
                'Apenas eventos pendentes ou rejeitados podem ser gerenciados por aqui.',
                'error',
                { group: DASHBOARD_STATUS_TOAST_GROUP },
            );
            return;
        }

        try {
            if (requestedAction === 'edit') {
                await this.#eventFormModal.open({ event: managedEvent });
                return;
            }

            if (requestedAction === 'delete') {
                await this.#deleteEventModal.open({ event: managedEvent });
            }
        } catch {
            this.#showToast(
                'Não foi possível abrir essa ação agora.',
                'error',
                { group: DASHBOARD_STATUS_TOAST_GROUP },
            );
        }
    }

    /**
     * Renders every dashboard section driven by the current state snapshot.
     */
    #renderDashboardSections() {
        this.#renderHeader();
        this.#renderOverview();
        this.#renderEventList();
    }

    /**
     * Updates the account chip using the current session state.
     */
    #renderHeader() {
        if (this.#elements.roleChip) {
            this.#elements.roleChip.textContent = readRoleLabel(this.#session?.user?.role);
        }
    }

    /**
     * Renders the overview cards and the section badge.
     */
    #renderOverview() {
        const cards = createSummaryCards(this.#events);
        const fragment = document.createDocumentFragment();

        cards.forEach((card) => {
            fragment.appendChild(createSummaryCardElement(card));
        });

        this.#elements.summaryGrid.replaceChildren(fragment);

        if (this.#elements.overviewBadge) {
            this.#elements.overviewBadge.textContent = formatCount(this.#events.length, 'envio', 'envios');
        }

        if (this.#elements.overviewNote) {
            const pendingCount = countEvents(this.#events, event => readStatusMeta(event?.status).tone === 'pending');
            const pendingSummary = pendingCount === 1
                ? '1 envio está aguardando aprovação'
                : `${pendingCount} envios estão aguardando aprovação`;

            this.#elements.overviewNote.textContent = this.#events.length === 0
                ? 'Assim que você criar o primeiro evento, os indicadores de moderação e agenda começam a aparecer aqui.'
                : (pendingCount > 0
                    ? `${pendingSummary} no momento.`
                    : 'Você não tem envios pendentes agora. Use este painel para acompanhar os próximos movimentos da conta.');
        }
    }

    /**
     * Renders the current user's event list and empty state.
     */
    #renderEventList() {
        if (this.#elements.eventsBadge) {
            this.#elements.eventsBadge.textContent = formatCount(this.#events.length, 'evento', 'eventos');
        }

        if (this.#elements.eventsCaption) {
            this.#elements.eventsCaption.textContent = this.#events.length > 0
                ? 'Abaixo ficam todos os seus eventos, ordenados da data mais recente para a mais antiga.'
                : 'Quando novos envios forem criados, eles aparecerão aqui com o respectivo status de moderação.';
        }

        if (this.#events.length === 0) {
            this.#elements.eventsList.replaceChildren();
            this.#elements.eventsEmpty?.classList.remove(DASHBOARD_HIDDEN_CLASS);
            return;
        }

        const fragment = document.createDocumentFragment();
        this.#events.forEach((event) => {
            fragment.appendChild(createDashboardEventElement(event));
        });

        this.#elements.eventsList.replaceChildren(fragment);
        this.#elements.eventsEmpty?.classList.add(DASHBOARD_HIDDEN_CLASS);
    }

    /**
     * Emits a shared toast for dashboard status changes.
     */
    #showToast(text, tone = 'info', options = {}) {
        const normalizedText = readText(text, '');
        if (!normalizedText) {
            return null;
        }

        return Toast.show(normalizedText, {
            tone,
            group: options.group,
            duration: options.duration ?? (tone === 'success' ? 4400 : 6000),
        });
    }
}

new DashboardPage().init();