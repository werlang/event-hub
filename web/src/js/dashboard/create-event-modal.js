import { Form } from '../components/form.js';
import { Modal } from '../components/modal.js';
import { Toast } from '../components/toast.js';
import { requestApi } from '../helpers/api.js';

const CREATE_EVENT_MODAL_FILE = '/html/dashboard-create-event-modal.html';
const DASHBOARD_CREATE_TOAST_GROUP = 'dashboard-create';
const DASHBOARD_ACTION_TOAST_GROUP = 'dashboard-action';

/**
 * Returns a safe user-facing text fallback.
 */
function readText(value, fallback) {
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    return normalizedValue || fallback;
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

export class DashboardCreateEventModal {
    #modal;
    #form = null;
    #preloadPromise = null;
    #sessionToken = '';
    #successHandlers = new Set();
    #trigger = null;
    #triggerClickHandler = () => {
        void this.open().catch(() => {
            this.#showToast(
                'Não foi possível abrir o formulário de criação agora.',
                'error',
                { group: DASHBOARD_CREATE_TOAST_GROUP },
            );
        });
    };

    /**
     * Creates the reusable dashboard modal used to submit new events.
     */
    constructor({ trigger = null } = {}) {
        this.#modal = new Modal({
            id: 'dashboard-create-modal',
            size: 'large',
            eyebrow: 'Nova postagem',
            title: 'Enviar evento para moderação',
            description: 'Revise os dados com atenção antes de confirmar o envio.',
        });

        this.#modal.onClose(() => {
            this.#destroyForm();
        });

        this.bindTrigger(trigger);
        this.#preloadPromise = this.preload().catch(() => null);
    }

    /**
     * Binds the button or link responsible for opening this modal.
     */
    bindTrigger(trigger) {
        if (this.#trigger) {
            this.#trigger.removeEventListener('click', this.#triggerClickHandler);
        }

        this.#trigger = trigger || null;
        this.#trigger?.addEventListener('click', this.#triggerClickHandler);
        return this;
    }

    /**
     * Stores the active authenticated session token used by the submit flow.
     */
    setSession(session = null) {
        this.#sessionToken = readText(session?.token, '');
        return this;
    }

    /**
     * Registers a callback fired after a successful event submission.
     */
    onCreateSuccess(callback) {
        if (typeof callback === 'function') {
            this.#successHandlers.add(callback);
        }

        return this;
    }

    /**
     * Preloads the modal body template into the shared modal cache.
     */
    async preload() {
        await this.#modal.preloadContentFromFile(CREATE_EVENT_MODAL_FILE);
        return this;
    }

    /**
     * Loads a fresh form body, wires handlers, and opens the modal.
     */
    async open({ args = {} } = {}) {
        this.#destroyForm();
        Toast.dismissGroup(DASHBOARD_CREATE_TOAST_GROUP);
        await this.#modal.loadContentFromFile(CREATE_EVENT_MODAL_FILE, { args });

        this.#form = new Form(this.#modal.get('#dashboard-modal-create-form'));
        const dateField = this.#modal.get('#dashboard-modal-event-date');
        if (dateField) {
            dateField.value = createDefaultDateTimeValue();
        }

        this.#form.getButton('dashboard-modal-create-cancel')?.click(() => {
            this.close();
        }, { manageBusy: false });

        this.#form.submit(async (formData, formComponent) => {
            await this.#handleSubmit(formData, formComponent);
        });

        this.#modal.open({ focusTarget: '#dashboard-modal-event-title' });
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
        if (this.#trigger) {
            this.#trigger.removeEventListener('click', this.#triggerClickHandler);
        }

        this.#destroyForm();
        this.#successHandlers.clear();
        this.#modal.destroy();
        return this;
    }

    /**
     * Reads the create form data into the API payload shape.
     */
    #readPayload(formData = {}) {
        return {
            title: readText(formData.title, ''),
            description: readText(formData.description, ''),
            date: readText(formData.date, ''),
            category: readText(formData.category, 'Geral'),
            location: readText(formData.location, 'A definir'),
        };
    }

    /**
     * Validates, submits, and resolves the create-event modal lifecycle.
     */
    async #handleSubmit(formData, formComponent) {
        const payload = this.#readPayload(formData);

        if (!payload.title || !payload.description || !payload.date) {
            this.#showToast(
                'Preencha título, descrição e data antes de enviar o evento.',
                'error',
                { group: DASHBOARD_CREATE_TOAST_GROUP },
            );
            return;
        }

        if (!this.#sessionToken) {
            this.#showToast(
                'Não foi possível validar a sua sessão agora.',
                'error',
                { group: DASHBOARD_CREATE_TOAST_GROUP },
            );
            return;
        }

        Toast.dismissGroup(DASHBOARD_CREATE_TOAST_GROUP);
        formComponent.disable({ stateKey: 'submit' });

        try {
            const response = await requestApi('/events', {
                method: 'POST',
                token: this.#sessionToken,
                body: payload,
            });

            if (!response.ok) {
                this.#showToast(
                    response.message || 'Não foi possível enviar o evento para aprovação.',
                    'error',
                    { group: DASHBOARD_CREATE_TOAST_GROUP },
                );
                return;
            }

            this.close();
            await this.#emitCreateSuccess({
                createdEvent: response.data?.event || null,
                response,
            });
            this.#showToast(
                response.message || 'Evento enviado para aprovação com sucesso.',
                'success',
                { group: DASHBOARD_ACTION_TOAST_GROUP },
            );
        } finally {
            formComponent.enable({ stateKey: 'submit' });
        }
    }

    /**
     * Notifies success subscribers after the modal creates a new event.
     */
    async #emitCreateSuccess(detail) {
        for (const callback of this.#successHandlers) {
            await callback(detail, this);
        }
    }

    /**
     * Emits a shared toast for the create-event modal lifecycle.
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

    /**
     * Cleans up the active form wrapper before reloading or destroying the modal.
     */
    #destroyForm() {
        this.#form?.destroy();
        this.#form = null;
    }
}

export default DashboardCreateEventModal;