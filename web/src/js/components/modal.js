import { BaseComponent } from './base-component.js';

let activeModal = null;
let modalSequence = 0;

/**
 * Creates a stable unique token for modal-owned element ids.
 */
function createModalToken(prefix) {
    modalSequence += 1;
    return `${prefix}-${modalSequence}`;
}

/**
 * Reports whether a value exposes a usable focus method.
 */
function isFocusableElement(value) {
    return Boolean(value && typeof value.focus === 'function');
}

/**
 * Appends string, node, fragment, or array content into a target container.
 */
function appendModalContent(container, content) {
    if (!container || content == null) {
        return;
    }

    if (Array.isArray(content)) {
        content.forEach(item => appendModalContent(container, item));
        return;
    }

    if (content instanceof Node) {
        container.appendChild(content);
        return;
    }

    if (typeof content === 'string' && content.trim()) {
        container.insertAdjacentHTML('beforeend', content);
    }
}

/**
 * Resolves the button modifier class used by modal footer actions.
 */
function readActionToneClass(tone) {
    return String(tone || 'ghost').trim().toLowerCase() === 'primary'
        ? 'button--primary'
        : 'button--ghost';
}

/**
 * Schedules focus after the browser has had one frame to mount the dialog.
 */
function scheduleFocus(callback) {
    if (typeof callback !== 'function') {
        return;
    }

    if (typeof globalThis.requestAnimationFrame === 'function') {
        globalThis.requestAnimationFrame(callback);
        return;
    }

    globalThis.setTimeout(callback, 0);
}

export class Modal extends BaseComponent {
    #backdrop;
    #header;
    #eyebrow;
    #title;
    #description;
    #body;
    #actions;
    #closeButton;
    #actionMap = new Map();
    #closeHandlers = new Set();
    #keydownHandler;
    #isOpen = false;
    #previouslyFocusedElement = null;
    #closeOnBackdrop = true;
    #closeOnEscape = true;
    #restoreFocus = true;

    /**
     * Creates a reusable modal dialog with optional header copy and footer actions.
     */
    constructor({
        id,
        title = '',
        eyebrow = '',
        description = '',
        content = null,
        size = 'default',
        closeOnBackdrop = true,
        closeOnEscape = true,
        restoreFocus = true,
        showCloseButton = true,
        actions = [],
    } = {}) {
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';

        const dialog = document.createElement('section');
        dialog.className = 'modal';
        dialog.tabIndex = -1;
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');

        if (typeof id === 'string' && id.trim()) {
            dialog.id = id.trim();
        }

        if (String(size).trim().toLowerCase() === 'large') {
            dialog.classList.add('modal--large');
        }

        const header = document.createElement('header');
        header.className = 'modal__header';

        const headerCopy = document.createElement('div');
        headerCopy.className = 'modal__header-copy';

        const eyebrowElement = document.createElement('p');
        eyebrowElement.className = 'modal__eyebrow';
        eyebrowElement.hidden = true;

        const titleElement = document.createElement('h2');
        titleElement.className = 'modal__title';
        titleElement.id = createModalToken('modal-title');
        titleElement.hidden = true;

        const descriptionElement = document.createElement('p');
        descriptionElement.className = 'modal__description';
        descriptionElement.id = createModalToken('modal-description');
        descriptionElement.hidden = true;

        headerCopy.append(eyebrowElement, titleElement, descriptionElement);

        const closeButton = document.createElement('button');
        closeButton.className = 'modal__close';
        closeButton.type = 'button';
        closeButton.setAttribute('aria-label', 'Fechar janela');
        closeButton.innerHTML = '<span aria-hidden="true">&times;</span>';
        closeButton.hidden = !showCloseButton;

        header.append(headerCopy, closeButton);

        const body = document.createElement('div');
        body.className = 'modal__body';

        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'modal__actions';
        actionsContainer.hidden = true;

        dialog.append(header, body, actionsContainer);
        backdrop.appendChild(dialog);

        super(dialog);

        this.#backdrop = backdrop;
        this.#header = header;
        this.#eyebrow = eyebrowElement;
        this.#title = titleElement;
        this.#description = descriptionElement;
        this.#body = body;
        this.#actions = actionsContainer;
        this.#closeButton = closeButton;
        this.#closeOnBackdrop = Boolean(closeOnBackdrop);
        this.#closeOnEscape = Boolean(closeOnEscape);
        this.#restoreFocus = Boolean(restoreFocus);
        this.#keydownHandler = event => this.#handleDocumentKeydown(event);

        this.on(this.#backdrop, 'click', event => {
            if (event.target === this.#backdrop && this.#closeOnBackdrop) {
                this.close();
            }
        });
        this.on(this.#closeButton, 'click', () => this.close());

        this.setEyebrow(eyebrow);
        this.setTitle(title);
        this.setDescription(description);
        this.setContent(content);

        if (Array.isArray(actions)) {
            actions.forEach(action => this.addAction(action));
        }
    }

    /**
     * Reports whether the modal is currently mounted in the document.
     */
    isOpen() {
        return this.#isOpen;
    }

    /**
     * Opens the modal and optionally focuses a specific field or selector.
     */
    open({ focusTarget = null } = {}) {
        if (activeModal && activeModal !== this) {
            activeModal.close({ returnFocus: false });
        }

        if (this.#isOpen) {
            this.focus(focusTarget);
            return this;
        }

        this.#previouslyFocusedElement = isFocusableElement(document.activeElement)
            ? document.activeElement
            : null;

        document.body.appendChild(this.#backdrop);
        document.body.classList.add('modal-open');
        document.addEventListener('keydown', this.#keydownHandler);

        activeModal = this;
        this.#isOpen = true;

        scheduleFocus(() => {
            this.focus(focusTarget);
        });

        return this;
    }

    /**
     * Closes the modal and optionally restores focus to the opener element.
     */
    close({ returnFocus = true } = {}) {
        if (!this.#isOpen) {
            return this;
        }

        this.#isOpen = false;
        if (activeModal === this) {
            activeModal = null;
        }

        document.removeEventListener('keydown', this.#keydownHandler);
        this.#backdrop.remove();

        if (!document.querySelector('.modal-backdrop')) {
            document.body.classList.remove('modal-open');
        }

        Array.from(this.#closeHandlers).forEach(callback => {
            callback(this);
        });

        if (returnFocus && this.#restoreFocus && isFocusableElement(this.#previouslyFocusedElement)) {
            this.#previouslyFocusedElement.focus();
        }

        return this;
    }

    /**
     * Returns the dialog root or one element within the mounted modal tree.
     */
    get(selector) {
        if (!selector) {
            return super.get();
        }

        if (this.#backdrop.matches(selector)) {
            return this.#backdrop;
        }

        return this.#backdrop.querySelector(selector);
    }

    /**
     * Returns every element matching the provided selector in the modal tree.
     */
    getAll(selector) {
        return this.#backdrop.querySelectorAll(selector);
    }

    /**
     * Replaces the small eyebrow copy displayed above the modal title.
     */
    setEyebrow(text = '') {
        const normalizedText = typeof text === 'string' ? text.trim() : '';
        this.#eyebrow.textContent = normalizedText;
        this.#eyebrow.hidden = !normalizedText;
        this.#syncHeaderVisibility();
        return this;
    }

    /**
     * Replaces the dialog title and refreshes its accessibility attributes.
     */
    setTitle(text = '') {
        const normalizedText = typeof text === 'string' ? text.trim() : '';
        this.#title.textContent = normalizedText;
        this.#title.hidden = !normalizedText;

        if (normalizedText) {
            this.get().setAttribute('aria-labelledby', this.#title.id);
            this.get().removeAttribute('aria-label');
        } else {
            this.get().removeAttribute('aria-labelledby');
            this.get().setAttribute('aria-label', 'Janela modal');
        }

        this.#syncHeaderVisibility();
        return this;
    }

    /**
     * Replaces the supporting description shown below the modal title.
     */
    setDescription(text = '') {
        const normalizedText = typeof text === 'string' ? text.trim() : '';
        this.#description.textContent = normalizedText;
        this.#description.hidden = !normalizedText;

        if (normalizedText) {
            this.get().setAttribute('aria-describedby', this.#description.id);
        } else {
            this.get().removeAttribute('aria-describedby');
        }

        this.#syncHeaderVisibility();
        return this;
    }

    /**
     * Replaces the modal body content.
     */
    setContent(content) {
        this.#body.replaceChildren();
        appendModalContent(this.#body, content);
        return this;
    }

    /**
     * Appends extra content to the end of the modal body.
     */
    append(content) {
        appendModalContent(this.#body, content);
        return this;
    }

    /**
     * Removes every footer action previously attached to the modal.
     */
    clearActions() {
        this.#actions.replaceChildren();
        this.#actionMap.clear();
        this.#syncActionsVisibility();
        return this;
    }

    /**
     * Adds one footer action button and stores it by id when provided.
     */
    addAction({
        id,
        label,
        callback,
        tone = 'ghost',
        type = 'button',
        closeOnClick = false,
        autofocus = false,
        title,
        disabled = false,
    } = {}) {
        const button = document.createElement('button');
        button.type = type;
        button.className = `button ${readActionToneClass(tone)}`;
        button.textContent = typeof label === 'string' && label.trim() ? label.trim() : 'Continuar';
        button.disabled = Boolean(disabled);

        if (typeof id === 'string' && id.trim()) {
            button.id = id.trim();
            this.#actionMap.set(button.id, button);
        }

        if (typeof title === 'string' && title.trim()) {
            button.setAttribute('title', title.trim());
        }

        if (autofocus) {
            button.autofocus = true;
        }

        this.on(button, 'click', async (event) => {
            let shouldClose = Boolean(closeOnClick);

            if (typeof callback === 'function') {
                const result = await callback(event, this);
                if (result === false) {
                    shouldClose = false;
                }
            }

            if (shouldClose) {
                this.close();
            }
        });

        this.#actions.appendChild(button);
        this.#syncActionsVisibility();
        return this;
    }

    /**
     * Returns one footer action button by id when it exists.
     */
    getAction(id) {
        return this.#actionMap.get(id) || null;
    }

    /**
     * Registers a callback that runs every time the modal closes.
     */
    onClose(callback) {
        if (typeof callback === 'function') {
            this.#closeHandlers.add(callback);
        }

        return this;
    }

    /**
     * Focuses one element inside the modal, falling back to the first useful target.
     */
    focus(target = null) {
        const focusTarget = this.#resolveFocusTarget(target);
        focusTarget?.focus();
        return this;
    }

    /**
     * Destroys the modal instance and clears tracked DOM listeners.
     */
    destroy() {
        this.close({ returnFocus: false });
        this.#actionMap.clear();
        this.#closeHandlers.clear();
        return super.destroy();
    }

    /**
     * Handles Escape presses while the modal is mounted.
     */
    #handleDocumentKeydown(event) {
        if (!this.#isOpen || !this.#closeOnEscape || event.key !== 'Escape') {
            return;
        }

        event.preventDefault();
        this.close();
    }

    /**
     * Resolves the element that should receive focus for the current open cycle.
     */
    #resolveFocusTarget(target) {
        if (typeof target === 'string' && target.trim()) {
            return this.get(target.trim()) || this.#findFallbackFocusTarget();
        }

        if (isFocusableElement(target)) {
            return target;
        }

        return this.#findFallbackFocusTarget();
    }

    /**
     * Finds the first field, button, or link worth focusing inside the modal.
     */
    #findFallbackFocusTarget() {
        return this.get('[autofocus]')
            || this.get('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]):not(.modal__close), [href], [tabindex]:not([tabindex="-1"])')
            || this.#closeButton
            || this.get();
    }

    /**
     * Shows or hides the modal header depending on available content.
     */
    #syncHeaderVisibility() {
        const hasVisibleText = !this.#eyebrow.hidden || !this.#title.hidden || !this.#description.hidden;
        this.#header.hidden = !hasVisibleText && this.#closeButton.hidden;
    }

    /**
     * Shows or hides the footer action row depending on button count.
     */
    #syncActionsVisibility() {
        this.#actions.hidden = this.#actions.children.length === 0;
    }
}

export default Modal;