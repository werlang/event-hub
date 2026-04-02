import { BaseComponent } from './base-component.js';

const TOOLTIP_VISIBLE_CLASS = 'tooltip--visible';
let tooltipTokenCounter = 0;

/**
 * Returns a trimmed string when the provided value is usable.
 */
function readText(value, fallback = '') {
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    return normalizedValue || fallback;
}

/**
 * Normalizes class name input into a flat array of class tokens.
 */
function normalizeClassList(value) {
    if (Array.isArray(value)) {
        return value.flatMap(item => normalizeClassList(item));
    }

    if (typeof value !== 'string' || !value.trim()) {
        return [];
    }

    return value.trim().split(/\s+/);
}

/**
 * Expands a Font Awesome icon descriptor into concrete class names.
 */
function normalizeIconClasses(icon) {
    const normalizedIcon = readText(icon, 'circle-question');

    if (normalizedIcon.includes(' ')) {
        return normalizedIcon.split(/\s+/);
    }

    return ['fa-solid', `fa-${normalizedIcon}`];
}

/**
 * Resolves the placement modifier applied to the tooltip root.
 */
function readPlacementClass(placement) {
    return readText(placement, 'top').toLowerCase() === 'bottom'
        ? 'tooltip--bottom'
        : 'tooltip--top';
}

/**
 * Reports whether a focus target remains inside the current tooltip.
 */
function isWithinTooltip(root, target) {
    return Boolean(root && target instanceof Node && root.contains(target));
}

/**
 * Creates a unique DOM id for one tooltip bubble.
 */
function createTooltipToken() {
    tooltipTokenCounter += 1;
    return `tooltip-${tooltipTokenCounter}`;
}

export class Tooltip extends BaseComponent {
    #trigger;
    #bubble;
    #content;
    #visible = false;
    #hasContent = false;

    /**
     * Creates a reusable tooltip cue with hover and focus behavior.
     */
    constructor({
        content = '',
        label = 'Mostrar ajuda',
        icon = 'circle-question',
        placement = 'top',
        customClass,
    } = {}) {
        const element = document.createElement('span');
        element.className = 'tooltip';

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'tooltip__trigger';

        const iconElement = document.createElement('i');
        iconElement.classList.add(...normalizeIconClasses(icon));
        iconElement.setAttribute('aria-hidden', 'true');
        trigger.appendChild(iconElement);

        const bubble = document.createElement('span');
        bubble.className = 'tooltip__bubble';
        bubble.id = createTooltipToken();
        bubble.setAttribute('role', 'tooltip');

        const contentElement = document.createElement('span');
        contentElement.className = 'tooltip__content';
        bubble.appendChild(contentElement);

        element.append(trigger, bubble);
        super(element);

        this.#trigger = trigger;
        this.#bubble = bubble;
        this.#content = contentElement;

        normalizeClassList(customClass).forEach(className => {
            element.classList.add(className);
        });
        element.classList.add(readPlacementClass(placement));

        this.setLabel(label);
        this.setContent(content);

        this.on(element, 'mouseenter', () => this.open());
        this.on(element, 'mouseleave', () => {
            if (!element.matches(':focus-within')) {
                this.close();
            }
        });
        this.on(element, 'focusin', () => this.open());
        this.on(element, 'focusout', (event) => {
            if (!isWithinTooltip(element, event.relatedTarget) && !element.matches(':hover')) {
                this.close();
            }
        });
        this.on(element, 'keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                this.close();
                this.#trigger.focus();
            }
        });
    }

    /**
     * Returns the interactive cue button used by the tooltip.
     */
    getTrigger() {
        return this.#trigger;
    }

    /**
     * Updates the tooltip message and hides the cue when empty.
     */
    setContent(content = '') {
        const normalizedContent = readText(content);
        this.#hasContent = Boolean(normalizedContent);
        this.#content.textContent = normalizedContent;
        this.get().hidden = !this.#hasContent;

        if (!this.#hasContent) {
            this.close();
        }

        return this;
    }

    /**
     * Updates the accessible label announced for the tooltip cue.
     */
    setLabel(label = 'Mostrar ajuda') {
        this.#trigger.setAttribute('aria-label', readText(label, 'Mostrar ajuda'));
        this.#trigger.setAttribute('aria-describedby', this.#bubble.id);
        return this;
    }

    /**
     * Reports whether the tooltip bubble is currently visible.
     */
    isOpen() {
        return this.#visible;
    }

    /**
     * Shows the tooltip bubble when content is available.
     */
    open() {
        if (!this.#hasContent) {
            return this;
        }

        this.#visible = true;
        this.get().classList.add(TOOLTIP_VISIBLE_CLASS);
        return this;
    }

    /**
     * Hides the tooltip bubble.
     */
    close() {
        this.#visible = false;
        this.get().classList.remove(TOOLTIP_VISIBLE_CLASS);
        return this;
    }

    /**
     * Clears listeners and resets visibility before disposal.
     */
    destroy() {
        this.close();
        return super.destroy();
    }
}