import { Modal } from '../components/modal.js';
import { Toast } from '../components/toast.js';
import { requestApi } from '../helpers/api.js';
import { canManageOwnEvent, normalizeEventStatus } from './event-management.js';

const DASHBOARD_DELETE_TOAST_GROUP = 'dashboard-delete';
const DASHBOARD_ACTION_TOAST_GROUP = 'dashboard-action';

/**
 * Returns a safe user-facing text fallback.
 */
function readText(value, fallback) {
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    return normalizedValue || fallback;
}

/**
 * Returns the localized moderation label used by the confirmation copy.
 */
function readStatusLabel(status) {
    const normalizedStatus = normalizeEventStatus(status);

    if (normalizedStatus === 'rejected') {
        return 'Rejeitado';
    }

    if (normalizedStatus === 'published') {
        return 'Publicado';
    }

    return 'Pendente';
}

/**
 * Builds the confirmation body shown before deleting an event.
 */
function createDeleteConfirmationContent(event) {
    const wrapper = document.createElement('div');
    wrapper.className = 'dashboard-modal dashboard-modal--confirm';

    const intro = document.createElement('p');
    intro.className = 'dashboard-modal__intro';
    intro.textContent = `Você está prestes a excluir o evento "${readText(event?.title, 'Sem título')}".`;

    const statusNote = document.createElement('p');
    statusNote.className = 'dashboard-settings-note';
    statusNote.textContent = `Status atual: ${readStatusLabel(event?.status)}.`;

    const consequenceNote = document.createElement('p');
    consequenceNote.className = 'dashboard-settings-note';
    consequenceNote.textContent = 'Depois da exclusão, o envio sai do painel. Se quiser recuperar a publicação, será preciso criar um novo evento.';

    wrapper.append(intro, statusNote, consequenceNote);
    return wrapper;
}

export class DashboardDeleteEventModal {
    #modal;
    #sessionToken = '';
    #successHandlers = new Set();
    #activeEvent = null;

    /**
     * Creates the reusable dashboard confirmation modal for event deletion.
     */
    constructor() {
        this.#modal = new Modal({
            id: 'dashboard-delete-event-modal',
            eyebrow: 'Excluir envio',
            title: 'Confirmar exclusão',
            description: 'Confira os dados antes de remover o evento do seu painel.',
        });

        this.#modal.addAction({
            id: 'dashboard-delete-cancel',
            label: 'Cancelar',
            icon: 'ban',
            tone: 'ghost',
            closeOnClick: true,
        });

        this.#modal.addAction({
            id: 'dashboard-delete-confirm',
            label: 'Excluir evento',
            icon: 'trash',
            tone: 'primary',
            autofocus: true,
            callback: async () => this.#handleConfirm(),
        });

        this.#modal.onClose(() => {
            this.#activeEvent = null;
            this.#restoreActions();
        });
    }

    /**
     * Stores the active authenticated session token used by the delete flow.
     */
    setSession(session = null) {
        this.#sessionToken = readText(session?.token, '');
        return this;
    }

    /**
     * Registers a callback fired after a successful event deletion.
     */
    onDeleteSuccess(callback) {
        if (typeof callback === 'function') {
            this.#successHandlers.add(callback);
        }

        return this;
    }

    /**
     * Loads the confirmation copy for the provided event and opens the modal.
     */
    async open({ event = null } = {}) {
        if (!event?.id) {
            return this;
        }

        if (!canManageOwnEvent(event)) {
            this.#showToast(
                'Apenas eventos pendentes ou rejeitados podem ser excluídos por aqui.',
                'error',
                { group: DASHBOARD_DELETE_TOAST_GROUP },
            );
            return this;
        }

        this.#activeEvent = event;
        this.#modal.setContent(createDeleteConfirmationContent(event));
        this.#restoreActions();
        Toast.dismissGroup(DASHBOARD_DELETE_TOAST_GROUP);
        this.#modal.open({ focusTarget: '#dashboard-delete-confirm' });
        return this;
    }

    /**
     * Closes the confirmation modal.
     */
    close() {
        this.#modal.close();
        return this;
    }

    /**
     * Destroys the confirmation modal instance.
     */
    destroy() {
        this.#successHandlers.clear();
        this.#modal.destroy();
        return this;
    }

    /**
     * Executes the delete request after the user confirms the action.
     */
    async #handleConfirm() {
        const currentEvent = this.#activeEvent;
        if (!currentEvent?.id) {
            return false;
        }

        if (!canManageOwnEvent(currentEvent)) {
            this.#showToast(
                'Apenas eventos pendentes ou rejeitados podem ser excluídos por aqui.',
                'error',
                { group: DASHBOARD_DELETE_TOAST_GROUP },
            );
            return false;
        }

        if (!this.#sessionToken) {
            this.#showToast(
                'Não foi possível validar a sua sessão agora.',
                'error',
                { group: DASHBOARD_DELETE_TOAST_GROUP },
            );
            return false;
        }

        this.#setActionsDisabled(true);

        try {
            const response = await requestApi(`/events/${currentEvent.id}`, {
                method: 'DELETE',
                token: this.#sessionToken,
            });

            if (!response.ok) {
                this.#showToast(
                    response.message || 'Não foi possível excluir o evento agora.',
                    'error',
                    { group: DASHBOARD_DELETE_TOAST_GROUP },
                );
                return false;
            }

            this.close();
            await this.#emitDeleteSuccess({
                event: currentEvent,
                eventId: currentEvent.id,
                response,
            });
            this.#showToast(
                response.message || 'Evento excluído.',
                'success',
                { group: DASHBOARD_ACTION_TOAST_GROUP },
            );
            return false;
        } finally {
            this.#restoreActions();
        }
    }

    /**
     * Notifies subscribers after the modal deletes an event.
     */
    async #emitDeleteSuccess(detail) {
        for (const callback of this.#successHandlers) {
            await callback(detail, this);
        }
    }

    /**
     * Toggles the footer action availability during the delete request.
     */
    #setActionsDisabled(disabled) {
        const confirmButton = this.#modal.getAction('dashboard-delete-confirm');
        const cancelButton = this.#modal.getAction('dashboard-delete-cancel');

        if (confirmButton) {
            confirmButton.disabled = Boolean(disabled);
        }

        if (cancelButton) {
            cancelButton.disabled = Boolean(disabled);
        }
    }

    /**
     * Restores the default enabled state for the modal footer actions.
     */
    #restoreActions() {
        this.#setActionsDisabled(false);
    }

    /**
     * Emits a shared toast for the delete-event modal lifecycle.
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

export default DashboardDeleteEventModal;