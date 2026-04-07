import { Form } from '../components/form.js';
import { Button } from '../components/button.js';
import { Modal } from '../components/modal.js';
import { Toast } from '../components/toast.js';
import { requestApi } from '../helpers/api.js';
import { canManageOwnEvent, formatDateTimeLocalInputValue } from './event-management.js';

const CREATE_EVENT_MODAL_FILE = '/html/dashboard-create-event-modal.html';
const DASHBOARD_EVENT_FORM_TOAST_GROUP = 'dashboard-event-form';
const DASHBOARD_ACTION_TOAST_GROUP = 'dashboard-action';
const DASHBOARD_EVENT_FORM_MODE_CREATE = 'create';
const DASHBOARD_EVENT_FORM_MODE_EDIT = 'edit';
const triggerButtonMap = new WeakMap();

const DASHBOARD_EVENT_FORM_COPY = {
    [DASHBOARD_EVENT_FORM_MODE_CREATE]: {
        eyebrow: 'Nova postagem',
        title: 'Enviar evento para moderação',
        description: 'Revise os dados com atenção antes de confirmar o envio.',
        intro: 'Preencha os campos abaixo para enviar um novo evento para moderação.',
        submitLabel: 'Enviar para aprovação',
        submitIcon: 'paper-plane',
        invalidMessage: 'Preencha título, descrição e data antes de enviar o evento.',
        requestMessage: 'Não foi possível enviar o evento para aprovação.',
        successMessage: 'Evento enviado para aprovação com sucesso.',
    },
    [DASHBOARD_EVENT_FORM_MODE_EDIT]: {
        eyebrow: 'Editar envio',
        title: 'Atualizar evento',
        description: 'Ajuste os dados antes de reenviar o evento para avaliação.',
        intro: 'Revise os campos abaixo e reenvie o evento para moderação.',
        submitLabel: 'Salvar e reenviar',
        submitIcon: 'pen-to-square',
        invalidMessage: 'Preencha título, descrição e data antes de salvar as alterações.',
        requestMessage: 'Não foi possível atualizar o evento agora.',
        successMessage: 'Evento atualizado e enviado para moderação.',
    },
};

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

/**
 * Rebuilds one button label with the requested icon and text.
 */
function setButtonContent(button, { label, icon } = {}) {
    if (!button) {
        return;
    }

    button.replaceChildren();

    if (typeof icon === 'string' && icon.trim()) {
        const iconElement = document.createElement('i');
        iconElement.classList.add('fa-solid', `fa-${icon.trim()}`);
        iconElement.setAttribute('aria-hidden', 'true');
        button.appendChild(iconElement);
    }

    const labelElement = document.createElement('span');
    labelElement.textContent = readText(label, 'Continuar');
    button.appendChild(labelElement);
}

/**
 * Synchronizes a select field with an existing value, preserving custom categories.
 */
function syncSelectValue(selectField, value, fallbackValue = '') {
    if (!(selectField instanceof HTMLSelectElement)) {
        return;
    }

    const normalizedValue = readText(value, fallbackValue);
    if (!normalizedValue) {
        selectField.value = '';
        return;
    }

    const hasMatchingOption = Array.from(selectField.options)
        .some(option => option.value === normalizedValue);

    if (!hasMatchingOption) {
        const customOption = document.createElement('option');
        customOption.value = normalizedValue;
        customOption.textContent = normalizedValue;
        selectField.appendChild(customOption);
    }

    selectField.value = normalizedValue;
}

/**
 * Returns the reusable Button wrapper associated with one modal trigger.
 */
function getTriggerButton(trigger) {
    if (!(trigger instanceof HTMLButtonElement)) {
        return null;
    }

    if (!triggerButtonMap.has(trigger)) {
        triggerButtonMap.set(trigger, new Button({
            element: trigger,
            loadingLabel: `${readText(trigger.textContent, 'Carregando')}...`,
        }));
    }

    return triggerButtonMap.get(trigger);
}

export class DashboardEventFormModal {
    #modal;
    #form = null;
    #preloadPromise = null;
    #sessionToken = '';
    #successHandlers = new Set();
    #trigger = null;
    #activeEvent = null;
    #activeMode = DASHBOARD_EVENT_FORM_MODE_CREATE;
    #triggerClickHandler = async (event) => {
        const triggerButton = getTriggerButton(event?.currentTarget);

        try {
            triggerButton?.disable({ showBusy: true });
            await this.open();
        } catch {
            this.#showToast(
                'Não foi possível abrir o formulário do evento agora.',
                'error',
                { group: DASHBOARD_EVENT_FORM_TOAST_GROUP },
            );
        } finally {
            triggerButton?.enable();
        }
    };

    /**
     * Creates the reusable dashboard modal used to create or edit events.
     */
    constructor({ trigger = null } = {}) {
        this.#modal = new Modal({
            id: 'dashboard-event-form-modal',
            size: 'large',
            eyebrow: DASHBOARD_EVENT_FORM_COPY[DASHBOARD_EVENT_FORM_MODE_CREATE].eyebrow,
            title: DASHBOARD_EVENT_FORM_COPY[DASHBOARD_EVENT_FORM_MODE_CREATE].title,
            description: DASHBOARD_EVENT_FORM_COPY[DASHBOARD_EVENT_FORM_MODE_CREATE].description,
        });

        this.#modal.onClose(() => {
            this.#destroyForm();
            this.#activeEvent = null;
            this.#activeMode = DASHBOARD_EVENT_FORM_MODE_CREATE;
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
     * Registers a callback fired after a successful create or edit action.
     */
    onSubmitSuccess(callback) {
        if (typeof callback === 'function') {
            this.#successHandlers.add(callback);
        }

        return this;
    }

    /**
     * Registers a callback fired after a successful event submission.
     */
    onCreateSuccess(callback) {
        return this.onSubmitSuccess(callback);
    }

    /**
     * Preloads the modal body template into the shared modal cache.
     */
    async preload() {
        await this.#modal.preloadContentFromFile(CREATE_EVENT_MODAL_FILE);
        return this;
    }

    /**
     * Loads a fresh form body, wires handlers, and opens the modal for create or edit.
     */
    async open({ args = {}, event = null } = {}) {
        if (event?.id && !canManageOwnEvent(event)) {
            this.#showToast(
                'Apenas eventos pendentes ou rejeitados podem ser editados por aqui.',
                'error',
                { group: DASHBOARD_EVENT_FORM_TOAST_GROUP },
            );
            return this;
        }

        this.#activeEvent = event?.id ? event : null;
        this.#activeMode = this.#activeEvent
            ? DASHBOARD_EVENT_FORM_MODE_EDIT
            : DASHBOARD_EVENT_FORM_MODE_CREATE;

        this.#destroyForm();
        Toast.dismissGroup(DASHBOARD_EVENT_FORM_TOAST_GROUP);
        await this.#modal.loadContentFromFile(CREATE_EVENT_MODAL_FILE, { args });
        this.#applyModalCopy();

        this.#form = new Form(this.#modal.get('#dashboard-modal-create-form'));
        this.#populateFormFields();

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
            category: readText(formData.category, 'outro'),
            location: readText(formData.location, 'A definir'),
        };
    }

    /**
     * Validates, submits, and resolves the create-event modal lifecycle.
     */
    async #handleSubmit(formData, formComponent) {
        const payload = this.#readPayload(formData);
        const copy = DASHBOARD_EVENT_FORM_COPY[this.#activeMode];

        if (!payload.title || !payload.description || !payload.date) {
            this.#showToast(
                copy.invalidMessage,
                'error',
                { group: DASHBOARD_EVENT_FORM_TOAST_GROUP },
            );
            return;
        }

        if (!this.#sessionToken) {
            this.#showToast(
                'Não foi possível validar a sua sessão agora.',
                'error',
                { group: DASHBOARD_EVENT_FORM_TOAST_GROUP },
            );
            return;
        }

        Toast.dismissGroup(DASHBOARD_EVENT_FORM_TOAST_GROUP);

        const response = await requestApi(this.#readRequestPath(), {
            method: this.#readRequestMethod(),
            token: this.#sessionToken,
            body: payload,
        });

        if (!response.ok) {
            this.#showToast(
                response.message || copy.requestMessage,
                'error',
                { group: DASHBOARD_EVENT_FORM_TOAST_GROUP },
            );
            return;
        }

        const mode = this.#activeMode;
        const previousEventId = this.#activeEvent?.id || null;
        this.close();
        await this.#emitSubmitSuccess({
            event: response.data?.event || null,
            mode,
            previousEventId,
            response,
        });
        this.#showToast(
            response.message || copy.successMessage,
            'success',
            { group: DASHBOARD_ACTION_TOAST_GROUP },
        );
    }

    /**
     * Applies the active mode copy to the loaded modal body.
     */
    #applyModalCopy() {
        const copy = DASHBOARD_EVENT_FORM_COPY[this.#activeMode];

        this.#modal
            .setEyebrow(copy.eyebrow)
            .setTitle(copy.title)
            .setDescription(copy.description);

        const intro = this.#modal.get('.dashboard-modal__intro');
        if (intro) {
            intro.textContent = copy.intro;
        }

        setButtonContent(this.#modal.get('#dashboard-modal-create-submit'), {
            label: copy.submitLabel,
            icon: copy.submitIcon,
        });
    }

    /**
     * Populates the form fields for create or edit mode.
     */
    #populateFormFields() {
        const titleField = this.#modal.get('#dashboard-modal-event-title');
        const dateField = this.#modal.get('#dashboard-modal-event-date');
        const descriptionField = this.#modal.get('#dashboard-modal-event-description');
        const categoryField = this.#modal.get('#dashboard-modal-event-category');
        const locationField = this.#modal.get('#dashboard-modal-event-location');

        if (!this.#activeEvent) {
            if (dateField) {
                dateField.value = createDefaultDateTimeValue();
            }

            return;
        }

        if (titleField) {
            titleField.value = readText(this.#activeEvent.title, '');
        }

        if (dateField) {
            dateField.value = formatDateTimeLocalInputValue(this.#activeEvent.date)
                || createDefaultDateTimeValue();
        }

        if (descriptionField) {
            descriptionField.value = readText(this.#activeEvent.description, '');
        }

        syncSelectValue(categoryField, this.#activeEvent.category, 'outro');

        if (locationField) {
            locationField.value = readText(this.#activeEvent.location, '');
        }
    }

    /**
     * Returns the API path used by the active form mode.
     */
    #readRequestPath() {
        return this.#activeMode === DASHBOARD_EVENT_FORM_MODE_EDIT && this.#activeEvent?.id
            ? `/events/${this.#activeEvent.id}`
            : '/events';
    }

    /**
     * Returns the HTTP method used by the active form mode.
     */
    #readRequestMethod() {
        return this.#activeMode === DASHBOARD_EVENT_FORM_MODE_EDIT ? 'PUT' : 'POST';
    }

    /**
     * Notifies success subscribers after the modal finishes a submission.
     */
    async #emitSubmitSuccess(detail) {
        for (const callback of this.#successHandlers) {
            await callback(detail, this);
        }
    }

    /**
     * Emits a shared toast for the event-form modal lifecycle.
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

export { DashboardEventFormModal as DashboardCreateEventModal };

export default DashboardEventFormModal;