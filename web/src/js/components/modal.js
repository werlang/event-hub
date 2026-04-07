import { BaseComponent } from './base-component.js';
import { Button } from './button.js';

let activeModal = null;
let modalSequence = 0;
const MODAL_HIDDEN_CLASS = 'modal__hidden';
const modalContentCache = new Map();
const HTML_ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
};

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
 * Expands an icon descriptor into the classes needed for Font Awesome rendering.
 */
function readActionIconClasses(icon) {
    if (typeof icon !== 'string' || !icon.trim()) {
        return [];
    }

    if (icon.includes(' ')) {
        return icon.trim().split(/\s+/);
    }

    return ['fa-solid', `fa-${icon.trim()}`];
}

/**
 * Writes one modal footer button label with optional icon markup.
 */
function setActionButtonContent(button, label, icon) {
    const normalizedLabel = typeof label === 'string' && label.trim() ? label.trim() : 'Continuar';
    button.replaceChildren();

    const iconClasses = readActionIconClasses(icon);
    if (iconClasses.length) {
        const iconElement = document.createElement('i');
        iconElement.classList.add(...iconClasses);
        iconElement.setAttribute('aria-hidden', 'true');
        button.appendChild(iconElement);
    }

    const labelElement = document.createElement('span');
    labelElement.textContent = normalizedLabel;
    button.appendChild(labelElement);
}

/**
 * Returns the busy-state label used by one modal footer action.
 */
function readActionLoadingLabel(label) {
    const normalizedLabel = typeof label === 'string' ? label.trim() : '';
    return normalizedLabel ? `${normalizedLabel}...` : 'Carregando...';
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

/**
 * Retrieves and caches HTML content loaded from a public file path.
 */
async function fetchModalContentFile(filePath, { forceRefresh = false } = {}) {
    const normalizedPath = typeof filePath === 'string' ? filePath.trim() : '';

    if (!normalizedPath) {
        throw new Error('A modal content file path is required.');
    }

    if (!forceRefresh && modalContentCache.has(normalizedPath)) {
        return modalContentCache.get(normalizedPath);
    }

    const request = fetch(normalizedPath)
        .then(async (response) => {
            if (!response.ok) {
                throw new Error(`Unable to load modal content from "${normalizedPath}".`);
            }

            return response.text();
        })
        .catch((error) => {
            if (modalContentCache.get(normalizedPath) === request) {
                modalContentCache.delete(normalizedPath);
            }

            throw error;
        });

    modalContentCache.set(normalizedPath, request);
    return request;
}

/**
 * Escapes HTML-sensitive characters in template argument values.
 */
function escapeTemplateValue(value) {
    const normalizedValue = value == null ? '' : String(value);
    return normalizedValue.replace(/[&<>"']/g, character => HTML_ESCAPE_MAP[character]);
}

/**
 * Reads one template argument by supporting dot-separated object paths.
 */
function readTemplateValue(args, key) {
    return String(key || '')
        .split('.')
        .reduce((currentValue, segment) => {
            if (!segment || currentValue == null || typeof currentValue !== 'object') {
                return undefined;
            }

            return currentValue[segment];
        }, args);
}

/**
 * Replaces {{token}} placeholders in loaded HTML using escaped template arguments.
 */
function applyTemplateArgs(template, args = {}) {
    const normalizedArgs = args && typeof args === 'object' ? args : {};

    return String(template || '').replace(/{{\s*([\w.-]+)\s*}}/g, (_match, key) => {
        const value = readTemplateValue(normalizedArgs, key);

        if (value == null) {
            return '';
        }

        if (typeof value === 'object') {
            return Array.isArray(value)
                ? escapeTemplateValue(value.join(', '))
                : '';
        }

        return escapeTemplateValue(value);
    });
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
        eyebrowElement.classList.add(MODAL_HIDDEN_CLASS);

        const titleElement = document.createElement('h2');
        titleElement.className = 'modal__title';
        titleElement.id = createModalToken('modal-title');
        titleElement.classList.add(MODAL_HIDDEN_CLASS);

        const descriptionElement = document.createElement('p');
        descriptionElement.className = 'modal__description';
        descriptionElement.id = createModalToken('modal-description');
        descriptionElement.classList.add(MODAL_HIDDEN_CLASS);

        headerCopy.append(eyebrowElement, titleElement, descriptionElement);

        const closeButton = document.createElement('button');
        closeButton.className = 'modal__close';
        closeButton.type = 'button';
        closeButton.setAttribute('aria-label', 'Fechar janela');
        closeButton.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
        closeButton.classList.toggle(MODAL_HIDDEN_CLASS, !showCloseButton);

        header.append(headerCopy, closeButton);

        const body = document.createElement('div');
        body.className = 'modal__body';

        const actionsContainer = document.createElement('div');
        actionsContainer.className = 'modal__actions';
        actionsContainer.classList.add(MODAL_HIDDEN_CLASS);

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
        this.#eyebrow.classList.toggle(MODAL_HIDDEN_CLASS, !normalizedText);
        this.#syncHeaderVisibility();
        return this;
    }

    /**
     * Replaces the dialog title and refreshes its accessibility attributes.
     */
    setTitle(text = '') {
        const normalizedText = typeof text === 'string' ? text.trim() : '';
        this.#title.textContent = normalizedText;
        this.#title.classList.toggle(MODAL_HIDDEN_CLASS, !normalizedText);

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
        this.#description.classList.toggle(MODAL_HIDDEN_CLASS, !normalizedText);

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
     * Preloads and caches raw HTML content from a public file without mounting it.
     */
    async preloadContentFromFile(filePath, options = {}) {
        const { args, ...fetchOptions } = options;

        void args;
        await fetchModalContentFile(filePath, fetchOptions);
        return this;
    }

    /**
     * Loads HTML content from a public file, applies template arguments, and replaces the modal body.
     */
    async loadContentFromFile(filePath, options = {}) {
        const {
            args = {},
            ...fetchOptions
        } = options;
        const content = await fetchModalContentFile(filePath, fetchOptions);

        return this.setContent(applyTemplateArgs(content, args));
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
        icon,
        callback,
        tone = 'ghost',
        type = 'button',
        closeOnClick = false,
        autofocus = false,
        title,
        disabled = false,
    } = {}) {
        const button = new Button({
            element: document.createElement('button'),
            loadingLabel: readActionLoadingLabel(label),
        });

        button.get().type = type;
        button.get().className = `button ${readActionToneClass(tone)}`;
        setActionButtonContent(button.get(), label, icon);
        button.setDisabled(disabled);

        if (typeof id === 'string' && id.trim()) {
            button.get().id = id.trim();
            this.#actionMap.set(button.get().id, button);
        }

        if (typeof title === 'string' && title.trim()) {
            button.get().setAttribute('title', title.trim());
        }

        if (autofocus) {
            button.get().autofocus = true;
        }

        button.click(async (event) => {
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
        }, { manageBusy: typeof callback === 'function' });

        this.#actions.appendChild(button.get());
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
            const resolvedTarget = this.get(target.trim());

            return resolvedTarget && !resolvedTarget.closest(`.${MODAL_HIDDEN_CLASS}`)
                ? resolvedTarget
                : this.#findFallbackFocusTarget();
        }

        if (isFocusableElement(target) && !target.closest(`.${MODAL_HIDDEN_CLASS}`)) {
            return target;
        }

        return this.#findFallbackFocusTarget();
    }

    /**
     * Finds the first field, button, or link worth focusing inside the modal.
     */
    #findFallbackFocusTarget() {
        return Array.from(this.getAll('[autofocus]'))
            .find(element => !element.closest(`.${MODAL_HIDDEN_CLASS}`))
            || Array.from(this.getAll('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]):not(.modal__close), [href], [tabindex]:not([tabindex="-1"])'))
                .find(element => !element.closest(`.${MODAL_HIDDEN_CLASS}`))
            || (!this.#closeButton.classList.contains(MODAL_HIDDEN_CLASS) ? this.#closeButton : null)
            || this.get();
    }

    /**
     * Shows or hides the modal header depending on available content.
     */
    #syncHeaderVisibility() {
        const hasVisibleHeader = !this.#eyebrow.classList.contains(MODAL_HIDDEN_CLASS)
            || !this.#title.classList.contains(MODAL_HIDDEN_CLASS)
            || !this.#description.classList.contains(MODAL_HIDDEN_CLASS)
            || !this.#closeButton.classList.contains(MODAL_HIDDEN_CLASS);

        this.#header.classList.toggle(MODAL_HIDDEN_CLASS, !hasVisibleHeader && this.#closeButton.classList.contains(MODAL_HIDDEN_CLASS));
    }

    /**
     * Shows or hides the footer action row depending on button count.
     */
    #syncActionsVisibility() {
        this.#actions.classList.toggle(MODAL_HIDDEN_CLASS, this.#actionMap.size === 0);
    }
}

export default Modal;