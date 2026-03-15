import { BaseComponent } from './base-component.js';

const DEFAULT_DURATION = 5000;
const FADE_OFFSET_MS = 700;
const CLOSE_TRANSITION_MS = 180;
const FLASH_STORAGE_KEY = 'ae_flash_toast';
const TOAST_SELECTOR = '.toast';
const TOAST_CONTAINER_SELECTOR = '.toast-container';

/**
 * Returns the browser session storage when it is available.
 */
function getSessionStorage() {
    try {
        return globalThis.sessionStorage || null;
    } catch {
        return null;
    }
}

/**
 * Normalizes the requested toast tone into a supported variant.
 */
function normalizeTone(tone) {
    const normalizedTone = String(tone || 'info').trim().toLowerCase();

    if (['success', 'warning', 'error'].includes(normalizedTone)) {
        return normalizedTone;
    }

    return 'info';
}

/**
 * Normalizes the requested toast position into a supported variant.
 */
function normalizePosition(position) {
    return String(position || '').trim().toLowerCase() === 'center'
        ? 'center'
        : 'end';
}

/**
 * Normalizes a toast group identifier used to replace previous notifications.
 */
function normalizeGroup(group) {
    return typeof group === 'string' ? group.trim() : '';
}

/**
 * Reads the desired toast duration from supported option names.
 */
function readDuration({ duration, timeout, timeOut } = {}) {
    const rawDuration = [duration, timeout, timeOut].find(value => value != null);
    const normalizedDuration = Number(rawDuration);

    if (Number.isFinite(normalizedDuration) && normalizedDuration >= 0) {
        return normalizedDuration;
    }

    return DEFAULT_DURATION;
}

/**
 * Reports whether a value is a DOM node supported by the current runtime.
 */
function isNode(value) {
    return typeof Node !== 'undefined' && value instanceof Node;
}

/**
 * Appends string, node, fragment, or array toast content into the body element.
 */
function appendToastContent(container, content) {
    if (!container || content == null) {
        return;
    }

    if (Array.isArray(content)) {
        content.forEach(item => appendToastContent(container, item));
        return;
    }

    if (isNode(content)) {
        container.appendChild(content);
        return;
    }

    const text = String(content).trim();
    if (!text) {
        return;
    }

    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    container.appendChild(paragraph);
}

/**
 * Applies optional custom class names onto a toast element.
 */
function applyCustomClasses(element, customClass) {
    if (!element || typeof customClass !== 'string') {
        return;
    }

    customClass
        .split(/\s+/)
        .map(className => className.trim())
        .filter(Boolean)
        .forEach(className => element.classList.add(className));
}

/**
 * Removes toast containers that no longer contain visible notifications.
 */
function removeEmptyContainers() {
    document.querySelectorAll(TOAST_CONTAINER_SELECTOR).forEach((container) => {
        if (!container.querySelector(TOAST_SELECTOR)) {
            container.remove();
        }
    });
}

/**
 * Resolves the container responsible for one toast position.
 */
function resolveToastContainer(position) {
    const normalizedPosition = normalizePosition(position);
    const selector = `${TOAST_CONTAINER_SELECTOR}[data-position="${normalizedPosition}"]`;
    const existingContainer = document.querySelector(selector);
    if (existingContainer) {
        return existingContainer;
    }

    const container = document.createElement('div');
    container.className = `toast-container toast-container--${normalizedPosition}`;
    container.dataset.position = normalizedPosition;
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'Notificacoes do sistema');
    document.body.appendChild(container);
    return container;
}

export class Toast extends BaseComponent {
    #container;
    #title;
    #body;
    #closeButton;
    #duration;
    #fadeTimer = null;
    #dismissTimer = null;
    #removeTimer = null;
    #isClosed = false;

    /**
     * Creates and mounts one toast notification.
     */
    constructor(content, {
        title = '',
        tone = 'info',
        type,
        position = 'end',
        duration,
        timeout,
        timeOut,
        customClass,
        group,
        dismissible = true,
    } = {}) {
        const element = document.createElement('section');
        element.className = 'toast';
        element.setAttribute('aria-atomic', 'true');

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'toast__content';

        const titleElement = document.createElement('strong');
        titleElement.className = 'toast__title';
        titleElement.hidden = true;

        const bodyElement = document.createElement('div');
        bodyElement.className = 'toast__body';

        const closeButton = document.createElement('button');
        closeButton.className = 'toast__close';
        closeButton.type = 'button';
        closeButton.setAttribute('aria-label', 'Fechar notificacao');
        closeButton.innerHTML = '<span aria-hidden="true">&times;</span>';
        closeButton.hidden = !dismissible;

        contentWrapper.append(titleElement, bodyElement);
        element.append(contentWrapper, closeButton);

        super(element);

        const normalizedGroup = normalizeGroup(group);
        if (normalizedGroup) {
            Toast.dismissGroup(normalizedGroup);
            this.get().dataset.group = normalizedGroup;
        }

        this.#container = resolveToastContainer(position);
        this.#title = titleElement;
        this.#body = bodyElement;
        this.#closeButton = closeButton;
        this.#duration = readDuration({ duration, timeout, timeOut });

        applyCustomClasses(this.get(), customClass);
        this.on(this.#closeButton, 'click', () => this.close());

        this.setTone(type || tone);
        this.setTitle(title);
        this.setContent(content);

        this.#container.prepend(this.get());

        if (this.#duration > 0) {
            this.fade(this.#duration);
        }
    }

    /**
     * Creates a toast using the shared component API.
     */
    static show(content, options = {}) {
        return new Toast(content, options);
    }

    /**
     * Stores one toast so it can be displayed after the next navigation.
     */
    static flash(content, options = {}) {
        const normalizedContent = typeof content === 'string' ? content.trim() : '';
        if (!normalizedContent) {
            return null;
        }

        const storage = getSessionStorage();
        if (!storage) {
            return Toast.show(normalizedContent, options);
        }

        try {
            storage.setItem(FLASH_STORAGE_KEY, JSON.stringify({
                content: normalizedContent,
                options,
            }));
            return null;
        } catch {
            return Toast.show(normalizedContent, options);
        }
    }

    /**
     * Displays and clears the next queued flash toast when one exists.
     */
    static consumeFlash() {
        const storage = getSessionStorage();
        if (!storage) {
            return null;
        }

        const rawPayload = storage.getItem(FLASH_STORAGE_KEY);
        if (!rawPayload) {
            return null;
        }

        storage.removeItem(FLASH_STORAGE_KEY);

        try {
            const payload = JSON.parse(rawPayload);
            if (typeof payload?.content !== 'string' || !payload.content.trim()) {
                return null;
            }

            return Toast.show(payload.content, payload.options || {});
        } catch {
            return null;
        }
    }

    /**
     * Removes every visible toast currently assigned to one logical group.
     */
    static dismissGroup(group) {
        const normalizedGroup = normalizeGroup(group);
        if (!normalizedGroup) {
            return;
        }

        document.querySelectorAll(TOAST_SELECTOR).forEach((element) => {
            if (element.dataset.group === normalizedGroup) {
                element.remove();
            }
        });

        removeEmptyContainers();
    }

    /**
     * Updates the semantic tone classes applied to the current toast.
     */
    setTone(tone) {
        const normalizedTone = normalizeTone(tone);
        this.get().classList.remove(
            'toast--info',
            'toast--success',
            'toast--warning',
            'toast--error',
        );
        this.get().classList.add(`toast--${normalizedTone}`);
        this.get().dataset.tone = normalizedTone;
        this.get().setAttribute('role', normalizedTone === 'error' ? 'alert' : 'status');
        this.get().setAttribute('aria-live', normalizedTone === 'error' ? 'assertive' : 'polite');
        return this;
    }

    /**
     * Updates the semantic tone using the legacy type-oriented API.
     */
    setType(type) {
        return this.setTone(type);
    }

    /**
     * Updates the optional title rendered above the toast content.
     */
    setTitle(title = '') {
        const normalizedTitle = typeof title === 'string' ? title.trim() : '';
        this.#title.hidden = !normalizedTitle;
        this.#title.textContent = normalizedTitle;
        return this;
    }

    /**
     * Replaces the toast body content.
     */
    setContent(content) {
        this.#body.replaceChildren();
        appendToastContent(this.#body, content);
        return this;
    }

    /**
     * Schedules the toast removal lifecycle using the configured duration.
     */
    fade(duration = this.#duration) {
        const normalizedDuration = Number(duration);
        if (!Number.isFinite(normalizedDuration) || normalizedDuration <= 0 || this.#isClosed) {
            return this;
        }

        this.#clearTimers();

        const fadeDelay = Math.max(normalizedDuration - FADE_OFFSET_MS, 0);
        this.#fadeTimer = globalThis.setTimeout(() => {
            if (!this.#isClosed) {
                this.get().classList.add('toast--fade');
            }
        }, fadeDelay);

        this.#dismissTimer = globalThis.setTimeout(() => {
            this.close();
        }, normalizedDuration);

        return this;
    }

    /**
     * Dismisses the toast and removes its container when nothing remains inside it.
     */
    close({ immediate = false } = {}) {
        if (this.#isClosed) {
            return this;
        }

        this.#isClosed = true;
        this.#clearTimers();

        const removeToast = () => {
            this.clearListeners();
            this.get().remove();
            removeEmptyContainers();
        };

        if (immediate) {
            removeToast();
            return this;
        }

        this.get().classList.add('toast--fade');
        this.#removeTimer = globalThis.setTimeout(removeToast, CLOSE_TRANSITION_MS);
        return this;
    }

    /**
     * Clears the internal timers used by the current toast lifecycle.
     */
    #clearTimers() {
        globalThis.clearTimeout(this.#fadeTimer);
        globalThis.clearTimeout(this.#dismissTimer);
        globalThis.clearTimeout(this.#removeTimer);
        this.#fadeTimer = null;
        this.#dismissTimer = null;
        this.#removeTimer = null;
    }
}