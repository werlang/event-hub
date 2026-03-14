import '../css/dashboard.css';

import { AdminModerationList } from './components/admin-moderation-list.js';
import { AdminUserList, isPromotableUser } from './components/admin-user-list.js';
import { EventForm } from './components/event-form.js';
import { Form } from './components/form.js';
import { MemberEventList, canManageMemberEvent, describeMemberEventStatus } from './components/member-event-list.js';
import { StatusAlert } from './components/status-alert.js';
import { requestApi } from './helpers/api.js';
import { createLoginHref, syncHeaderSessionNavigation } from './helpers/session.js';

const DASHBOARD_PATH = '/dashboard';
const LOGIN_REDIRECT_REASONS = new Set(['missing-token', 'invalid-token']);
const EDIT_SELECTION_STATE_KEY = 'selection';
const EDIT_SUBMIT_STATE_KEY = 'submitting';
const PASSWORD_SUBMIT_STATE_KEY = 'submitting';

/**
 * Collects the dashboard shell elements used by the member dashboard flow.
 */
function createElements() {
    return {
        title: document.querySelector('#dashboard-title'),
        subtitle: document.querySelector('#dashboard-subtitle'),
        authAlert: document.querySelector('#dashboard-auth-alert'),
        shellHint: document.querySelector('#dashboard-shell-hint'),
        roleNote: document.querySelector('#dashboard-role-note'),
        adminSurface: document.querySelector('#dashboard-admin-surface'),
        adminUsersSummary: document.querySelector('#dashboard-admin-users-summary'),
        adminUsersAlert: document.querySelector('#dashboard-admin-users-alert'),
        adminUsersLoading: document.querySelector('#dashboard-admin-users-loading'),
        adminUsersEmpty: document.querySelector('#dashboard-admin-users-empty'),
        adminUsersList: document.querySelector('#dashboard-admin-users-list'),
        adminEventsSummary: document.querySelector('#dashboard-admin-events-summary'),
        adminEventsAlert: document.querySelector('#dashboard-admin-events-alert'),
        adminEventsLoading: document.querySelector('#dashboard-admin-events-loading'),
        adminEventsEmpty: document.querySelector('#dashboard-admin-events-empty'),
        adminEventsList: document.querySelector('#dashboard-admin-events-list'),
        eventsSummary: document.querySelector('#dashboard-events-summary'),
        eventsAlert: document.querySelector('#dashboard-events-alert'),
        eventsLoading: document.querySelector('#dashboard-events-loading'),
        eventsEmpty: document.querySelector('#dashboard-events-empty'),
        eventsList: document.querySelector('#dashboard-events-list'),
        accountName: document.querySelector('#dashboard-account-name'),
        accountEmail: document.querySelector('#dashboard-account-email'),
        accountRole: document.querySelector('#dashboard-account-role'),
        accountEventsTotal: document.querySelector('#dashboard-account-events-total'),
        passwordForm: document.querySelector('#dashboard-password-form'),
        passwordAlert: document.querySelector('#dashboard-password-alert'),
        passwordSuccess: document.querySelector('#dashboard-password-success'),
        editForm: document.querySelector('#dashboard-edit-form'),
        editAlert: document.querySelector('#dashboard-edit-alert'),
        editSelection: document.querySelector('#dashboard-edit-selection'),
        editHint: document.querySelector('#dashboard-edit-hint'),
        editCancel: document.querySelector('#dashboard-edit-cancel'),
    };
}

/**
 * Renders the dashboard auth alert with the current error message.
 */
function showAuthAlert(element, text) {
    if (!element) {
        return;
    }

    const message = typeof text === 'string' ? text.trim() : '';
    element.hidden = !message;
    element.textContent = message;
    element.classList.remove('alert--success', 'alert--error');

    if (message) {
        element.classList.add('alert--error');
    }
}

/**
 * Extracts a short greeting label from the authenticated user name.
 */
function readFirstName(name) {
    const normalizedName = String(name || '').trim();
    if (!normalizedName) {
        return 'participante';
    }

    return normalizedName.split(/\s+/)[0];
}

/**
 * Reports whether the current dashboard shell should redirect to login.
 */
function shouldRedirectToLogin(session) {
    return LOGIN_REDIRECT_REASONS.has(session?.reason);
}

/**
 * Converts a role code into the label used by the dashboard copy.
 */
function readRoleLabel(role) {
    return role === 'admin' ? 'Administrador' : 'Membro';
}

/**
 * Returns a pluralized label using the provided singular and plural forms.
 */
function pluralize(count, singular, plural) {
    return count === 1 ? singular : plural;
}

/**
 * Reports whether the current authenticated session belongs to an administrator.
 */
function isAdminSession(session) {
    return session?.user?.role === 'admin';
}

/**
 * Confirms one destructive or privileged dashboard action when the browser supports it.
 */
function confirmDashboardAction(message) {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
        return window.confirm(message);
    }

    return true;
}

/**
 * Counts the dashboard events grouped by moderation status.
 */
function summarizeEvents(events) {
    const summary = {
        total: 0,
        pending: 0,
        published: 0,
        rejected: 0,
    };

    if (!Array.isArray(events)) {
        return summary;
    }

    events.forEach((event) => {
        const status = describeMemberEventStatus(event?.status).value;
        summary.total += 1;
        summary[status] += 1;
    });

    return summary;
}

/**
 * Formats one ISO or date-only value for the dashboard edit form fields.
 */
function splitEventDateForForm(value) {
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    if (!normalizedValue) {
        return { date: '', time: '', includeTime: false };
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
        return {
            date: normalizedValue,
            time: '',
            includeTime: false,
        };
    }

    if (/^\d{4}-\d{2}-\d{2}T00:00:00(?:\.000)?Z$/.test(normalizedValue)) {
        return {
            date: normalizedValue.slice(0, 10),
            time: '',
            includeTime: false,
        };
    }

    const date = new Date(normalizedValue);
    if (Number.isNaN(date.getTime())) {
        return { date: '', time: '', includeTime: false };
    }

    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return {
        date: `${year}-${month}-${day}`,
        time: `${hours}:${minutes}`,
        includeTime: true,
    };
}

/**
 * Renders a clear unavailable state for the dashboard events surface.
 */
function renderEventsUnavailableState(elements, {
    summaryText = 'Seus eventos estão indisponíveis no momento.',
    detailText = 'Não foi possível carregar seus eventos agora.',
    accountEventsTotalText = 'Indisponível',
} = {}) {
    if (!elements) {
        return;
    }

    elements.eventsLoading.hidden = true;
    elements.eventsList.replaceChildren();
    elements.eventsList.hidden = true;
    elements.eventsEmpty.hidden = false;
    elements.eventsEmpty.textContent = detailText;
    elements.eventsSummary.textContent = summaryText;
    elements.accountEventsTotal.textContent = accountEventsTotalText;
}

/**
 * Renders the dashboard fallback state when the session cannot be validated.
 */
function renderUnavailableState(elements, message) {
    elements.title.textContent = 'Não foi possível abrir o dashboard.';
    elements.subtitle.textContent = 'Tente novamente em instantes ou refaça o login para continuar.';
    elements.shellHint.textContent = 'Sem uma sessão válida, seus dados pessoais e seus eventos não podem ser carregados.';
    elements.roleNote.textContent = 'Sem uma validação ativa de sessão, o dashboard não pode liberar as ferramentas da sua conta.';
    elements.adminSurface.hidden = true;
    renderEventsUnavailableState(elements, {
        summaryText: 'Seus eventos estão indisponíveis no momento.',
        detailText: 'Não foi possível validar sua sessão agora. Recarregue a página ou tente entrar novamente para consultar seus eventos.',
    });
    elements.accountName.textContent = 'Indisponível';
    elements.accountEmail.textContent = 'Indisponível';
    elements.accountRole.textContent = 'Sessão não validada';
    showAuthAlert(elements.authAlert, message);
}

class MemberDashboardPage {
    #editAlert;
    #editForm;
    #elements;
    #eventList;
    #events = [];
    #eventsAlert;
    #passwordAlert;
    #passwordForm;
    #session;
    #activeEventId = null;

    /**
     * Creates the logged-in member dashboard controller.
     */
    constructor({ elements, session }) {
        this.#elements = elements;
        this.#session = session;
        this.#eventsAlert = new StatusAlert(elements.eventsAlert);
        this.#editAlert = new StatusAlert(elements.editAlert);
        this.#passwordAlert = new StatusAlert(elements.passwordAlert);
        this.#eventList = new MemberEventList({
            list: elements.eventsList,
            emptyState: elements.eventsEmpty,
        });
        this.#editForm = new EventForm(elements.editForm).bind();
        this.#passwordForm = new Form(elements.passwordForm);
    }

    /**
     * Reports whether the member dashboard has every required surface available.
     */
    isReady() {
        return Boolean(
            this.#elements.title
            && this.#elements.subtitle
            && this.#elements.shellHint
            && this.#elements.roleNote
            && this.#elements.accountName
            && this.#elements.accountEmail
            && this.#elements.accountRole
            && this.#elements.accountEventsTotal
            && this.#eventList.isReady()
            && this.#editForm.isReady()
            && this.#passwordForm.isReady()
        );
    }

    /**
     * Boots the member dashboard shell, event list, and password flow.
     */
    async init() {
        this.#configureStaticShell();
        this.#bindActions();
        await this.refreshEvents();
    }

    /**
     * Reloads the current user's events and updates the member dashboard state.
     */
    async refreshEvents({ successMessage = '' } = {}) {
        this.#setEventsLoading(true);
        this.#eventsAlert.hide();

        const response = await requestApi('/events/mine', {
            token: this.#session.token,
        });

        this.#setEventsLoading(false);

        if (!response.ok) {
            this.#events = [];
            renderEventsUnavailableState(this.#elements, {
                summaryText: 'Não foi possível carregar seus eventos.',
                detailText: 'Não foi possível carregar seus eventos agora. Tente atualizar a página.',
            });
            this.clearEditingSelection();
            this.#eventsAlert.show(response.message || 'Não foi possível carregar seus eventos.');
            return;
        }

        this.#events = Array.isArray(response.data?.events) ? response.data.events : [];
        this.#eventList.render(this.#events, {
            emptyMessage: 'Você ainda não publicou eventos. Assim que enviar um novo evento, ele aparecerá aqui com o respectivo status.',
        });
        this.#renderEventSummary();

        if (successMessage) {
            this.#eventsAlert.show(successMessage, { isError: false });
        }

        if (this.#activeEventId) {
            const currentEvent = this.#findEvent(this.#activeEventId);
            if (currentEvent && canManageMemberEvent(currentEvent)) {
                this.startEditing(currentEvent.id, { shouldScroll: false });
                return;
            }

            this.clearEditingSelection();
        }
    }

    /**
     * Opens the event editor for one pending or rejected event.
     */
    startEditing(eventId, { shouldScroll = true } = {}) {
        const event = this.#findEvent(eventId);
        if (!event || !canManageMemberEvent(event)) {
            return;
        }

        const formDate = splitEventDateForForm(event.date);
        const status = describeMemberEventStatus(event.status);

        this.#activeEventId = event.id;
        this.#editAlert.hide();
        this.#setFormFieldValue('title', event.title || '');
        this.#setFormFieldValue('description', event.description || '');
        this.#setFormFieldValue('category', event.category || 'Geral');
        this.#setFormFieldValue('location', event.location || '');
        this.#setFormFieldValue('date', formDate.date);
        this.#setFormFieldValue('event-has-time', formDate.includeTime);
        this.#editForm.syncTimeState();
        this.#setFormFieldValue('event-time', formDate.time);
        this.#editForm.enable({ stateKey: EDIT_SELECTION_STATE_KEY });
        this.#elements.editSelection.textContent = `Editando: ${event.title}`;
        this.#elements.editHint.textContent = `${status.description} Ao salvar, o status volta para pendente.`;

        if (shouldScroll) {
            this.#elements.editForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    /**
     * Resets the event editor to its disabled, no-selection state.
     */
    clearEditingSelection() {
        this.#activeEventId = null;
        this.#editForm.reset();
        this.#editForm.syncTimeState();
        this.#editForm.disable({ stateKey: EDIT_SELECTION_STATE_KEY });
        this.#editAlert.hide();
        this.#elements.editSelection.textContent = 'Selecione um evento pendente ou rejeitado para liberar a edição.';
        this.#elements.editHint.textContent = 'Ao salvar, o evento volta para a fila de moderação com o status pendente.';
    }

    /**
     * Configures the member-specific shell copy before the first data fetch.
     */
    #configureStaticShell() {
        const firstName = readFirstName(this.#session.user?.name);
        const isAdmin = this.#session.user?.role === 'admin';

        this.#elements.title.textContent = `Olá, ${firstName}.`;
        this.#elements.subtitle.textContent = 'Acompanhe o status dos seus eventos, atualize os envios ainda não publicados e ajuste sua senha sem sair desta página.';
        this.#elements.shellHint.textContent = 'Seus envios são carregados em ordem da data mais recente para a mais antiga, com status claros de moderação.';
        this.#elements.roleNote.textContent = isAdmin
            ? 'Seu dashboard combina os fluxos de membro com os controles administrativos de promoção e moderação carregados abaixo.'
            : 'Seu dashboard mostra apenas os seus eventos e o fluxo de atualização da sua senha.';
        this.#elements.adminSurface.hidden = !isAdmin;
        this.#elements.accountName.textContent = this.#session.user?.name || '-';
        this.#elements.accountEmail.textContent = this.#session.user?.email || '-';
        this.#elements.accountRole.textContent = readRoleLabel(this.#session.user?.role);
        this.#eventsAlert.hide();
        this.#editAlert.hide();
        this.#passwordAlert.hide();
        this.#hidePasswordSuccess();
        this.#editForm.getSubmitButton()?.setLoadingLabel('Salvando evento...');
        this.#passwordForm.enable();
        this.#passwordForm.getSubmitButton()?.setLoadingLabel('Atualizando senha...');
        this.clearEditingSelection();
        showAuthAlert(this.#elements.authAlert, '');
    }

    /**
     * Registers the dashboard form submissions and event action callbacks.
     */
    #bindActions() {
        this.#eventList.bindActions({
            onEdit: (event) => {
                this.startEditing(event.id);
            },
            onDelete: async (event) => {
                await this.#deleteEvent(event);
            },
        });

        this.#editForm.submit(async (_values, form) => {
            await this.#submitEventUpdate(form);
        });

        this.#passwordForm.submit(async (values, form) => {
            await this.#submitPasswordUpdate(values, form);
        });

        this.#elements.editCancel?.addEventListener('click', () => {
            this.clearEditingSelection();
        });

        Array.from(this.#elements.passwordForm?.querySelectorAll('input') || []).forEach((field) => {
            field.addEventListener('input', () => {
                this.#hidePasswordSuccess();
            });
        });
    }

    /**
     * Renders the event counters used in the summary and account surface.
     */
    #renderEventSummary() {
        const summary = summarizeEvents(this.#events);
        this.#elements.accountEventsTotal.textContent = `${summary.total} ${pluralize(summary.total, 'cadastrado', 'cadastrados')}`;

        if (summary.total === 0) {
            this.#elements.eventsSummary.textContent = 'Nenhum evento cadastrado ainda. Assim que você publicar um novo evento, ele aparecerá aqui.';
            return;
        }

        this.#elements.eventsSummary.textContent = `${summary.total} ${pluralize(summary.total, 'evento encontrado', 'eventos encontrados')}. ${summary.published} publicados, ${summary.pending} em revisão e ${summary.rejected} rejeitados.`;
    }

    /**
     * Toggles the dashboard loading state used while events are being fetched.
     */
    #setEventsLoading(isLoading) {
        this.#elements.eventsLoading.hidden = !isLoading;

        if (isLoading) {
            this.#elements.eventsList.hidden = true;
            this.#elements.eventsEmpty.hidden = true;
            this.#elements.eventsSummary.textContent = 'Carregando seus eventos...';
        }
    }

    /**
     * Finds one event from the locally cached dashboard list.
     */
    #findEvent(eventId) {
        return this.#events.find(event => event.id === eventId) || null;
    }

    /**
     * Writes a value into one field of the edit form.
     */
    #setFormFieldValue(fieldKey, value) {
        this.#editForm.getField(fieldKey)?.setValue(value);
    }

    /**
     * Submits the selected event changes through the moderation-aware API flow.
     */
    async #submitEventUpdate(form) {
        const currentEvent = this.#findEvent(this.#activeEventId);
        if (!currentEvent || !canManageMemberEvent(currentEvent)) {
            this.#editAlert.show('Selecione um evento pendente ou rejeitado para editar.');
            return;
        }

        const payload = this.#editForm.toPayload();
        if (!payload.ok) {
            this.#editAlert.show(payload.message);
            return;
        }

        this.#editAlert.hide();
        form.disable({ stateKey: EDIT_SUBMIT_STATE_KEY });

        try {
            const response = await requestApi(`/events/${currentEvent.id}`, {
                method: 'PATCH',
                token: this.#session.token,
                body: payload.payload,
            });

            if (!response.ok) {
                this.#editAlert.show(response.message || 'Não foi possível atualizar o evento.');
                return;
            }

            this.clearEditingSelection();
            await this.refreshEvents({
                successMessage: response.message || 'Evento atualizado e reenviado para moderação.',
            });
        } finally {
            form.enable({ stateKey: EDIT_SUBMIT_STATE_KEY });
        }
    }

    /**
     * Deletes one pending or rejected event after the user confirms the action.
     */
    async #deleteEvent(event) {
        if (!canManageMemberEvent(event)) {
            this.#eventsAlert.show('Somente eventos ainda não publicados podem ser excluídos.');
            return;
        }

        const confirmed = confirmDashboardAction(`Excluir o evento "${event.title}"? Esta ação não pode ser desfeita.`);
        if (!confirmed) {
            return;
        }

        this.#eventsAlert.hide();
        const response = await requestApi(`/events/${event.id}`, {
            method: 'DELETE',
            token: this.#session.token,
        });

        if (!response.ok) {
            this.#eventsAlert.show(response.message || 'Não foi possível excluir o evento.');
            return;
        }

        if (this.#activeEventId === event.id) {
            this.clearEditingSelection();
        }

        await this.refreshEvents({
            successMessage: response.message || 'Evento excluido.',
        });
    }

    /**
     * Validates and submits the member password change form.
     */
    async #submitPasswordUpdate(values, form) {
        const currentPassword = String(values.currentPassword || '');
        const newPassword = String(values.newPassword || '');
        const confirmPassword = String(values.confirmPassword || '');

        this.#hidePasswordSuccess();
        this.#passwordAlert.hide();

        if (!currentPassword || !newPassword || !confirmPassword) {
            this.#passwordAlert.show('Preencha a senha atual, a nova senha e a confirmação.');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.#passwordAlert.show('A confirmação da nova senha não confere.');
            this.#passwordForm.getField('confirmPassword')?.focus();
            return;
        }

        if (currentPassword === newPassword) {
            this.#passwordAlert.show('Escolha uma nova senha diferente da atual.');
            this.#passwordForm.getField('newPassword')?.focus();
            return;
        }

        form.disable({ stateKey: PASSWORD_SUBMIT_STATE_KEY });

        try {
            const response = await requestApi('/auth/password', {
                method: 'PATCH',
                token: this.#session.token,
                body: {
                    currentPassword,
                    newPassword,
                },
            });

            if (!response.ok) {
                this.#passwordAlert.show(response.message || 'Não foi possível atualizar a senha.');
                return;
            }

            form.reset();
            this.#elements.passwordSuccess.textContent = response.message || 'Senha atualizada com sucesso.';
            this.#elements.passwordSuccess.hidden = false;
        } finally {
            form.enable({ stateKey: PASSWORD_SUBMIT_STATE_KEY });
        }
    }

    /**
     * Hides the password-success toast until the next successful update.
     */
    #hidePasswordSuccess() {
        this.#elements.passwordSuccess.hidden = true;
    }
}

class AdminDashboardTools {
    #elements;
    #events = [];
    #moderationAlert;
    #moderationList;
    #session;
    #userDirectory = new Map();
    #userList;
    #users = [];
    #usersAlert;

    /**
     * Creates the administrator-only dashboard controller.
     */
    constructor({ elements, session }) {
        this.#elements = elements;
        this.#session = session;
        this.#usersAlert = new StatusAlert(elements.adminUsersAlert);
        this.#moderationAlert = new StatusAlert(elements.adminEventsAlert);
        this.#userList = new AdminUserList({
            list: elements.adminUsersList,
            emptyState: elements.adminUsersEmpty,
        });
        this.#moderationList = new AdminModerationList({
            list: elements.adminEventsList,
            emptyState: elements.adminEventsEmpty,
            resolveOrganizer: event => this.#userDirectory.get(event?.organizerId) || null,
        });
    }

    /**
     * Reports whether every admin-only dashboard surface is available.
     */
    isReady() {
        return Boolean(
            this.#elements.adminSurface
            && this.#elements.adminUsersSummary
            && this.#elements.adminUsersLoading
            && this.#elements.adminEventsSummary
            && this.#elements.adminEventsLoading
            && this.#userList.isReady()
            && this.#moderationList.isReady()
        );
    }

    /**
     * Boots the administrator tools and loads both admin-only datasets.
     */
    async init() {
        this.#bindActions();
        await Promise.all([
            this.refreshUsers(),
            this.refreshModerationQueue(),
        ]);
    }

    /**
     * Reloads the user directory used by the promotion workflow.
     */
    async refreshUsers({ successMessage = '' } = {}) {
        this.#setUsersLoading(true);
        this.#usersAlert.hide();

        const response = await requestApi('/auth/users', {
            token: this.#session.token,
        });

        this.#setUsersLoading(false);

        if (!response.ok) {
            this.#users = [];
            this.#userList.clear({
                emptyMessage: 'Nao foi possivel carregar os usuarios administrativos agora.',
            });
            this.#elements.adminUsersSummary.textContent = 'A lista de usuarios administrativos esta indisponivel no momento.';
            this.#usersAlert.show(response.message || 'Nao foi possivel carregar os usuarios.');
            return;
        }

        this.#users = Array.isArray(response.data?.users) ? response.data.users : [];
        this.#userDirectory = new Map(this.#users.map(user => [user.id, user]));
        this.#renderUserSummary();
        this.#renderPromotableUsers();
        this.#renderModerationQueue();

        if (successMessage) {
            this.#usersAlert.show(successMessage, { isError: false });
        }
    }

    /**
     * Reloads the moderation queue for unpublished events from other users.
     */
    async refreshModerationQueue({ successMessage = '' } = {}) {
        this.#setModerationLoading(true);
        this.#moderationAlert.hide();

        const response = await requestApi('/events/moderation?status=pending', {
            token: this.#session.token,
        });

        this.#setModerationLoading(false);

        if (!response.ok) {
            this.#events = [];
            this.#moderationList.clear({
                emptyMessage: 'Nao foi possivel carregar a fila de moderacao agora.',
            });
            this.#elements.adminEventsSummary.textContent = 'A fila de moderacao esta indisponivel no momento.';
            this.#moderationAlert.show(response.message || 'Nao foi possivel carregar os eventos em moderacao.');
            return;
        }

        this.#events = Array.isArray(response.data?.events) ? response.data.events : [];
        this.#renderModerationQueue();

        if (successMessage) {
            this.#moderationAlert.show(successMessage, { isError: false });
        }
    }

    /**
     * Registers the callbacks used by the admin-only list actions.
     */
    #bindActions() {
        this.#userList.bindActions({
            onPromote: async (user) => {
                await this.#promoteUser(user);
            },
        });

        this.#moderationList.bindActions({
            onPublish: async (event) => {
                await this.#moderateEvent(event, 'published');
            },
            onReject: async (event) => {
                await this.#moderateEvent(event, 'rejected');
            },
        });
    }

    /**
     * Updates the admin user summary copy and renders the promotable users.
     */
    #renderUserSummary() {
        const promotableUsers = this.#users.filter(user => isPromotableUser(user));
        const userCount = this.#users.length;
        const promotableCount = promotableUsers.length;

        if (userCount === 0) {
            this.#elements.adminUsersSummary.textContent = 'Nenhuma outra conta foi encontrada para este dashboard.';
            return;
        }

        if (promotableCount === 0) {
            this.#elements.adminUsersSummary.textContent = `${userCount} ${pluralize(userCount, 'conta carregada', 'contas carregadas')}. Todas ja possuem acesso administrativo.`;
            return;
        }

        this.#elements.adminUsersSummary.textContent = `${promotableCount} ${pluralize(promotableCount, 'membro disponivel', 'membros disponiveis')} para promocao entre ${userCount} ${pluralize(userCount, 'conta carregada', 'contas carregadas')}.`;
    }

    /**
     * Renders only the users that still support promotion.
     */
    #renderPromotableUsers() {
        this.#userList.render(
            this.#users.filter(user => isPromotableUser(user)),
            { emptyMessage: 'Nenhum membro disponivel para promocao no momento.' },
        );
    }

    /**
     * Updates the moderation summary copy and renders the current queue.
     */
    #renderModerationQueue() {
        const eventCount = this.#events.length;

        if (eventCount === 0) {
            this.#elements.adminEventsSummary.textContent = 'Nenhum evento de outros usuarios aguarda moderacao agora.';
        } else {
            this.#elements.adminEventsSummary.textContent = `${eventCount} ${pluralize(eventCount, 'evento aguarda sua avaliacao', 'eventos aguardam sua avaliacao')}.`;
        }

        this.#moderationList.render(this.#events, {
            emptyMessage: 'Nenhum evento de outros usuarios aguarda moderacao agora.',
        });
    }

    /**
     * Toggles the loading state used by the user-promotion surface.
     */
    #setUsersLoading(isLoading) {
        this.#elements.adminUsersLoading.hidden = !isLoading;

        if (isLoading) {
            this.#elements.adminUsersList.hidden = true;
            this.#elements.adminUsersEmpty.hidden = true;
            this.#elements.adminUsersSummary.textContent = 'Carregando usuarios...';
        }
    }

    /**
     * Toggles the loading state used by the moderation queue surface.
     */
    #setModerationLoading(isLoading) {
        this.#elements.adminEventsLoading.hidden = !isLoading;

        if (isLoading) {
            this.#elements.adminEventsList.hidden = true;
            this.#elements.adminEventsEmpty.hidden = true;
            this.#elements.adminEventsSummary.textContent = 'Carregando eventos pendentes...';
        }
    }

    /**
     * Promotes one member account to administrator and refreshes the user list.
     */
    async #promoteUser(user) {
        const userName = user?.name || 'este usuario';
        const confirmed = confirmDashboardAction(`Promover ${userName} para administrador?`);
        if (!confirmed) {
            return;
        }

        this.#usersAlert.hide();
        const response = await requestApi(`/auth/users/${user.id}/promote`, {
            method: 'PATCH',
            token: this.#session.token,
        });

        if (!response.ok) {
            this.#usersAlert.show(response.message || 'Nao foi possivel promover o usuario.');
            return;
        }

        await this.refreshUsers({
            successMessage: response.message || 'Usuario promovido a administrador.',
        });
    }

    /**
     * Applies one moderation decision and refreshes the queue afterward.
     */
    async #moderateEvent(event, status) {
        const actionLabel = status === 'published' ? 'publicar' : 'rejeitar';
        const confirmed = confirmDashboardAction(`Deseja ${actionLabel} o evento "${event?.title || 'sem titulo'}"?`);
        if (!confirmed) {
            return;
        }

        this.#moderationAlert.hide();
        const response = await requestApi(`/events/${event.id}/moderation`, {
            method: 'PATCH',
            token: this.#session.token,
            body: { status },
        });

        if (!response.ok) {
            this.#moderationAlert.show(response.message || 'Nao foi possivel moderar o evento.');
            return;
        }

        await this.refreshModerationQueue({
            successMessage: response.message || 'Moderacao concluida.',
        });
    }
}

/**
 * Boots the dashboard page after validating the current session.
 */
async function initDashboardPage() {
    const elements = createElements();

    if (!elements.title || !elements.subtitle || !elements.authAlert || !elements.roleNote) {
        return;
    }

    const { session } = await syncHeaderSessionNavigation({
        redirectTarget: DASHBOARD_PATH,
        isDashboardPage: true,
    });

    if (session?.isAuthenticated) {
        const memberDashboard = new MemberDashboardPage({
            elements,
            session,
        });

        if (!memberDashboard.isReady()) {
            return;
        }

        await memberDashboard.init();

        if (isAdminSession(session)) {
            const adminDashboard = new AdminDashboardTools({
                elements,
                session,
            });

            if (adminDashboard.isReady()) {
                await adminDashboard.init();
            }
        }

        return;
    }

    if (shouldRedirectToLogin(session)) {
        window.location.replace(createLoginHref(DASHBOARD_PATH));
        return;
    }

    renderUnavailableState(
        elements,
        session?.message || 'Não foi possível validar sua sessão agora.',
    );
}

initDashboardPage();