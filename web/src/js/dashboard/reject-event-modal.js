import { Form } from '../components/form.js';
import { Modal } from '../components/modal.js';
import { Toast } from '../components/toast.js';
import { requestApi } from '../helpers/api.js';

const REJECT_EVENT_MODAL_FILE = '/html/dashboard-reject-event-modal.html';
const DASHBOARD_REJECT_EVENT_TOAST_GROUP = 'dashboard-reject-event';
const DASHBOARD_ACTION_TOAST_GROUP = 'dashboard-action';

/**
 * Returns a safe user-facing text fallback.
 */
function readText(value, fallback) {
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    return normalizedValue || fallback;
}

export class DashboardRejectEventModal {
    #modal;
    #form = null;
    #preloadPromise = null;
    #sessionToken = '';
    #successHandlers = new Set();
    #activeEvent = null;

    /**
     * Creates the reusable dashboard modal used for event rejection feedback.
     */
    constructor() {
        this.#modal = new Modal({
            id: 'dashboard-reject-event-modal',
            eyebrow: 'Rejeitar envio',
            title: 'Informar ajustes ao organizador',
            description: 'Adicione uma justificativa opcional para explicar por que o evento não foi aprovado.',
        });

        this.#modal.onClose(() => {
            this.#destroyForm();
            this.#activeEvent = null;
        });

        this.#preloadPromise = this.preload().catch(() => null);
    }

    /**
     * Stores the active authenticated session token used by the moderation flow.
     */
    setSession(session = null) {
        this.#sessionToken = readText(session?.token, '');
        return this;
    }

    /**
     * Registers a callback fired after a successful rejection action.
     */
    onRejectSuccess(callback) {
        if (typeof callback === 'function') {
            this.#successHandlers.add(callback);
        }

        return this;
    }

    /**
     * Preloads the modal body template into the shared modal cache.
     */
    async preload() {
        await this.#modal.preloadContentFromFile(REJECT_EVENT_MODAL_FILE);
        return this;
    }

    /**
     * Loads a fresh rejection form and opens the modal for the provided event.
     */
    async open({ event = null } = {}) {
        if (!event?.id) {
            return this;
        }

        this.#activeEvent = event;
        this.#destroyForm();
        Toast.dismissGroup(DASHBOARD_REJECT_EVENT_TOAST_GROUP);
        await this.#modal.loadContentFromFile(REJECT_EVENT_MODAL_FILE, { args: {
            eventTitle: readText(this.#activeEvent?.title, 'Sem título'),
        } });

        this.#form = new Form(this.#modal.get('#dashboard-modal-reject-form'));
        this.#form.getButton('dashboard-modal-reject-cancel')?.click(() => {
            this.close();
        }, { manageBusy: false });

        this.#form.submit(async (formData, formComponent) => {
            await this.#handleSubmit(formData, formComponent);
        });

        this.#modal.open({ focusTarget: '#dashboard-modal-reject-reason' });
        return this;
    }

    /**
     * Closes the modal dialog.
     */
    close() {
        this.#modal.close();
        return this;
    }

    /**
     * Destroys the modal instance and any tracked form wrapper.
     */
    destroy() {
        this.#destroyForm();
        this.#successHandlers.clear();
        this.#modal.destroy();
        return this;
    }

    /**
     * Reads the rejection form into the moderation API payload shape.
     */
    #readPayload(formData = {}) {
        return {
            status: 'rejected',
            rejectionReason: readText(formData.rejectionReason, ''),
        };
    }

    /**
     * Submits the rejection decision with optional feedback.
     */
    async #handleSubmit(formData, formComponent) {
        if (!this.#activeEvent?.id) {
            return;
        }

        if (!this.#sessionToken) {
            this.#showToast(
                'Não foi possível validar a sua sessão agora.',
                'error',
                { group: DASHBOARD_REJECT_EVENT_TOAST_GROUP },
            );
            return;
        }

        const payload = this.#readPayload(formData);
        Toast.dismissGroup(DASHBOARD_REJECT_EVENT_TOAST_GROUP);

        const response = await requestApi(`/events/${this.#activeEvent.id}/moderation`, {
            method: 'PUT',
            token: this.#sessionToken,
            body: payload,
        });

        if (!response.ok) {
            this.#showToast(
                response.message || 'Não foi possível rejeitar o evento agora.',
                'error',
                { group: DASHBOARD_REJECT_EVENT_TOAST_GROUP },
            );
            return;
        }

        this.close();
        await this.#emitRejectSuccess({
            event: response.data?.event || null,
            response,
        });
        this.#showToast(
            response.message || 'Evento rejeitado com sucesso.',
            'success',
            { group: DASHBOARD_ACTION_TOAST_GROUP },
        );
    }

    /**
     * Broadcasts a successful rejection to all subscribed listeners.
     */
    async #emitRejectSuccess(payload) {
        for (const handler of this.#successHandlers) {
            await handler(payload);
        }
    }

    /**
     * Disposes the current form wrapper if it exists.
     */
    #destroyForm() {
        this.#form?.destroy();
        this.#form = null;
    }

    /**
     * Emits a shared toast for reject-event modal failures.
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

export default DashboardRejectEventModal;