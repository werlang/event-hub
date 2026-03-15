import '../css/dashboard.css';

import { BaseComponent } from './components/base-component.js';
import { Form } from './components/form.js';
import { Header } from './components/header.js';
import { Modal } from './components/modal.js';
import { requestApi } from './helpers/api.js';
import { formatDateTimePtBr } from './helpers/date-format.js';
import { isPastEvent, sortEventsByDateDescending } from './helpers/event-sort.js';

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
        };
    }

    if (normalizedStatus === 'rejected') {
        return {
            label: 'Rejeitado',
            tone: 'warning',
            note: 'Este envio precisa de ajustes antes de voltar para aprovação.',
        };
    }

    return {
        label: 'Pendente',
        tone: 'pending',
        note: 'Este envio ainda está aguardando aprovação.',
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
function createMetaPill(text, modifier = '') {
    const pill = document.createElement('span');
    pill.className = modifier
        ? `dashboard-meta-pill dashboard-meta-pill--${modifier}`
        : 'dashboard-meta-pill';
    pill.textContent = text;
    return pill;
}

/**
 * Creates a rendered event card tailored for the dashboard list.
 */
function createDashboardEventElement(event) {
    const statusMeta = readStatusMeta(event?.status);
    const article = document.createElement('article');
    article.className = `dashboard-event dashboard-event--${statusMeta.tone}`;

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

    const statusPill = document.createElement('span');
    statusPill.className = `dashboard-status-pill dashboard-status-pill--${statusMeta.tone}`;
    statusPill.textContent = statusMeta.label;
    statusGroup.appendChild(statusPill);

    const timelinePill = document.createElement('span');
    timelinePill.className = 'dashboard-status-pill dashboard-status-pill--neutral';
    timelinePill.textContent = isPastEvent(event) ? 'Passado' : 'Em agenda';
    statusGroup.appendChild(timelinePill);

    header.append(title, statusGroup);

    const description = document.createElement('p');
    description.className = 'dashboard-event__description';
    description.textContent = readText(event?.description, 'Sem descrição.');

    const meta = document.createElement('div');
    meta.className = 'dashboard-event__meta';
    meta.append(
        createMetaPill(readText(event?.category, 'Geral'), 'category'),
        createMetaPill(readText(event?.location, 'A definir')),
        createMetaPill(formatDateTimePtBr(event?.date), 'date'),
    );

    const note = document.createElement('p');
    note.className = 'dashboard-event__note';
    note.textContent = statusMeta.note;

    article.append(header, description, meta, note);
    return article;
}

/**
 * Returns a default datetime-local value rounded to the next hour.
 */
function createDefaultDateTimeValue(referenceDate = new Date()) {
    const roundedDate = new Date(referenceDate);
    roundedDate.setMinutes(0, 0, 0);
    roundedDate.setHours(roundedDate.getHours() + 1);

    const year = String(roundedDate.getFullYear());
    const month = String(roundedDate.getMonth() + 1).padStart(2, '0');
    const day = String(roundedDate.getDate()).padStart(2, '0');
    const hours = String(roundedDate.getHours()).padStart(2, '0');
    const minutes = String(roundedDate.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Builds the modal body used for creating a new event from the dashboard.
 */
function createCreateModalContent() {
    const wrapper = document.createElement('div');
    wrapper.className = 'dashboard-modal dashboard-modal--create';
    wrapper.innerHTML = `
        <p class="dashboard-modal__intro">
            Preencha os campos abaixo para enviar um novo evento para moderação sem sair da sua área.
        </p>

        <p class="dashboard-feedback" id="dashboard-modal-create-feedback" hidden></p>

        <form class="form form--visible" id="dashboard-modal-create-form">
            <div class="form-row">
                <label for="dashboard-modal-event-title">
                    Título
                    <input id="dashboard-modal-event-title" name="title" type="text" maxlength="160"
                        placeholder="Ex.: Semana Acadêmica de Sistemas" required>
                </label>

                <label for="dashboard-modal-event-date">
                    Data e horário
                    <input id="dashboard-modal-event-date" name="date" type="datetime-local" required>
                </label>
            </div>

            <label for="dashboard-modal-event-description">
                Descrição
                <textarea id="dashboard-modal-event-description" name="description"
                    placeholder="Resumo do evento, tema central e público esperado."
                    required></textarea>
            </label>

            <div class="form-row">
                <label for="dashboard-modal-event-category">
                    Categoria
                    <select id="dashboard-modal-event-category" name="category">
                        <option value="Geral">Geral</option>
                        <option value="Pesquisa">Pesquisa</option>
                        <option value="Extensão">Extensão</option>
                        <option value="Comunidade">Comunidade</option>
                        <option value="Ensino">Ensino</option>
                        <option value="Cultura">Cultura</option>
                    </select>
                </label>

                <label for="dashboard-modal-event-location">
                    Local
                    <input id="dashboard-modal-event-location" name="location" type="text" maxlength="120"
                        placeholder="Auditório, sala, laboratório ou link">
                </label>
            </div>

            <div class="dashboard-modal__actions">
                <button class="button button--primary" id="dashboard-modal-create-submit" type="submit">
                    Enviar para aprovação
                </button>

                <button class="button button--ghost" id="dashboard-modal-create-cancel" type="button">
                    Cancelar
                </button>
            </div>
        </form>
    `;

    return {
        root: wrapper,
        feedback: wrapper.querySelector('#dashboard-modal-create-feedback'),
        form: wrapper.querySelector('#dashboard-modal-create-form'),
        titleField: wrapper.querySelector('#dashboard-modal-event-title'),
        dateField: wrapper.querySelector('#dashboard-modal-event-date'),
    };
}

/**
 * Builds the placeholder copy shown inside the user-settings modal.
 */
function createSettingsModalContent() {
    const wrapper = document.createElement('div');
    wrapper.className = 'dashboard-modal dashboard-modal--settings';
    wrapper.innerHTML = `
        <p class="dashboard-modal__intro">
            Esta área foi reservada para a próxima etapa do dashboard e vai concentrar as preferências da sua conta.
        </p>

        <ul class="list dashboard-settings-list">
            <li>Editar dados básicos do perfil e o nome exibido no cabeçalho.</li>
            <li>Revisar preferências de publicação e notificações sobre moderação.</li>
            <li>Acompanhar atalhos administrativos adicionais para contas com mais permissões.</li>
        </ul>

        <p class="dashboard-settings-note">
            Enquanto isso, o login, a listagem dos seus envios e a criação de novos eventos continuam disponíveis normalmente por aqui.
        </p>
    `;

    return wrapper;
}

class DashboardPage extends BaseComponent {
    #elements;
    #events = [];
    #session = null;

    /**
     * Creates the dashboard page controller around the page root.
     */
    constructor() {
        super(document.querySelector('#dashboard-root'));
        this.#elements = this.#collectElements();
    }

    /**
     * Boots the dashboard page once the required DOM is present.
     */
    async init() {
        if (!this.#isReady()) {
            return;
        }

        this.#wireActions();
        
        const header = new Header(true);
        const session = await header.getSession();
        if (!session) {
            return;
        }

        if (!session.isAuthenticated) {
            this.#setFeedback(
                this.#elements.pageMessage,
                session.message || 'Não foi possível validar a sua sessão agora.',
                'error',
            );
            return;
        }

        this.#session = session;
        this.#setFeedback(this.#elements.pageMessage, '');
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

        this.#setFeedback(this.#elements.pageMessage, '');

        const response = await requestApi('/events/mine', {
            token: this.#session.token,
        });

        if (!response.ok) {
            this.#events = [];
            this.#renderHeader();
            this.#renderOverview();
            this.#renderEventList();
            this.#setFeedback(
                this.#elements.pageMessage,
                response.message || 'Não foi possível carregar os seus eventos no momento.',
                'error',
            );
            return;
        }

        this.#events = sortEventsByDateDescending(response.data?.events || []);
        this.#renderHeader();
        this.#renderOverview();
        this.#renderEventList();
    }

    /**
     * Collects the DOM elements used throughout the dashboard lifecycle.
     */
    #collectElements() {
        const root = this.get();

        return {
            root,
            pageMessage: root?.querySelector('#dashboard-page-message') || null,
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
            actionFeedback: root?.querySelector('#dashboard-action-feedback') || null,
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
     * Wires every dashboard action handler.
     */
    #wireActions() {
        this.on(this.#elements.createToggle, 'click', () => {
            this.#openCreateModal();
        });

        this.on(this.#elements.settingsButton, 'click', () => {
            this.#openSettingsModal();
        });
    }

    /**
     * Opens the new-event modal and wires its submit lifecycle.
     */
    #openCreateModal() {
        const content = createCreateModalContent();
        const modal = new Modal({
            id: 'dashboard-create-modal',
            size: 'large',
            eyebrow: 'Nova postagem',
            title: 'Enviar evento para moderação',
            description: 'Revise os dados com atenção antes de confirmar o envio.',
            content: content.root,
        });
        const form = new Form(content.form);

        content.dateField.value = createDefaultDateTimeValue();
        this.#setFeedback(this.#elements.actionFeedback, '');

        form.getButton('dashboard-modal-create-cancel')?.click(() => {
            modal.close();
        }, { manageBusy: false });

        form.submit(async (data, formComponent) => {
            const payload = this.#readCreatePayload(data);
            if (!payload.title || !payload.description || !payload.date) {
                this.#setFeedback(
                    content.feedback,
                    'Preencha título, descrição e data antes de enviar o evento.',
                    'error',
                );
                return;
            }

            this.#setFeedback(content.feedback, '');
            formComponent.disable({ stateKey: 'submit' });

            try {
                const response = await requestApi('/events', {
                    method: 'POST',
                    token: this.#session.token,
                    body: payload,
                });

                if (!response.ok) {
                    this.#setFeedback(
                        content.feedback,
                        response.message || 'Não foi possível enviar o evento para aprovação.',
                        'error',
                    );
                    return;
                }

                const createdEvent = response.data?.event || null;
                if (createdEvent) {
                    this.#events = sortEventsByDateDescending([createdEvent, ...this.#events]);
                    this.#renderHeader();
                    this.#renderOverview();
                    this.#renderEventList();
                } else {
                    await this.refreshEvents();
                }

                if (this.#elements.eventsSection) {
                    this.#elements.eventsSection.open = true;
                }

                modal.close();
                this.#setFeedback(
                    this.#elements.actionFeedback,
                    response.message || 'Evento enviado para aprovação com sucesso.',
                    'success',
                );
            } finally {
                formComponent.enable({ stateKey: 'submit' });
            }
        });

        modal.onClose(() => {
            form.destroy();
        });
        modal.open({ focusTarget: content.titleField });
    }

    /**
     * Opens the placeholder modal reserved for future user settings.
     */
    #openSettingsModal() {
        const modal = new Modal({
            id: 'dashboard-settings-modal',
            eyebrow: 'Configurações',
            title: 'Preferências da conta',
            description: 'Esta área ainda está em preparação, mas já tem um lugar próprio dentro do dashboard.',
            content: createSettingsModalContent(),
        });

        this.#setFeedback(this.#elements.actionFeedback, '');
        modal.addAction({
            id: 'dashboard-settings-close',
            label: 'Entendi',
            tone: 'primary',
            closeOnClick: true,
            autofocus: true,
        });
        modal.open();
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
            this.#elements.eventsEmpty.hidden = false;
            return;
        }

        const fragment = document.createDocumentFragment();
        this.#events.forEach((event) => {
            fragment.appendChild(createDashboardEventElement(event));
        });

        this.#elements.eventsList.replaceChildren(fragment);
        this.#elements.eventsEmpty.hidden = true;
    }

    /**
     * Reads the create-form payload into the API contract shape.
     */
    #readCreatePayload(formData = {}) {
        return {
            title: readText(formData.title, ''),
            description: readText(formData.description, ''),
            date: readText(formData.date, ''),
            category: readText(formData.category, 'Geral'),
            location: readText(formData.location, 'A definir'),
        };
    }

    /**
     * Updates a dashboard feedback element with the given tone.
     */
    #setFeedback(element, text, tone = 'info') {
        if (!element) {
            return;
        }

        const normalizedText = readText(text, '');
        element.hidden = !normalizedText;
        element.textContent = normalizedText;
        element.classList.remove(
            'dashboard-feedback--info',
            'dashboard-feedback--success',
            'dashboard-feedback--error',
        );

        if (!normalizedText) {
            return;
        }

        element.classList.add(`dashboard-feedback--${tone}`);
    }
}

new DashboardPage().init();