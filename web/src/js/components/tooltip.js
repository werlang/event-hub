import { BaseComponent } from './base-component.js';

const TOOLTIP_VISIBLE_CLASS = 'tooltip--visible';
const TOOLTIP_GAP = 14;
const TOOLTIP_VIEWPORT_PADDING = 18;
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
function readPlacement(placement) {
    return readText(placement, 'top').toLowerCase() === 'bottom'
        ? 'bottom'
        : 'top';
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
    #placement;
    #standalone = false;
    #visible = false;
    #hasContent = false;

    /**
     * Creates a reusable tooltip cue with hover and focus behavior.
     */
    constructor({
        element = null,
        content = '',
        label = 'Mostrar ajuda',
        icon = 'circle-info',
        placement = 'top',
        customClass,
    } = {}) {
        const hasExistingElement = element instanceof HTMLElement;

        if (element instanceof HTMLElement && element.hasAttribute('title')) {
            content = readText(element.getAttribute('title'), '');
            element.removeAttribute('title');
        }

        const rootElement = hasExistingElement
            ? element
            : document.createElement('span');

        super(rootElement);
        this.#standalone = !hasExistingElement;

        rootElement.classList.add('tooltip');

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

        rootElement.appendChild(trigger);

        this.#trigger = trigger;
        this.#bubble = bubble;
        this.#content = contentElement;
        this.#placement = readPlacement(placement);

        normalizeClassList(customClass).forEach((className) => {
            rootElement.classList.add(className);
        });

        this.#mountBubble();
        this.#applyBubblePlacementClass(this.#placement);

        this.setLabel(label);
        this.setContent(content);

        this.on(trigger, 'mouseenter', () => this.open());
        this.on(trigger, 'mouseleave', () => {
            if (!trigger.matches(':focus-visible')) {
                this.close();
            }
        });
        this.on(trigger, 'focus', () => this.open());
        this.on(trigger, 'blur', (event) => {
            if (!isWithinTooltip(trigger, event.relatedTarget)) {
                this.close();
            }
        });
        this.on(trigger, 'keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                this.close();
                this.#trigger.focus();
            }
        });
        this.on(window, 'resize', () => this.#syncPosition());
        this.on(document, 'scroll', () => this.#syncPosition(), true);
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
        this.#trigger.hidden = !this.#hasContent;

        if (this.#standalone) {
            this.get().hidden = !this.#hasContent;
        }

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
        this.#mountBubble();
        this.#syncPosition();
        this.get().classList.add(TOOLTIP_VISIBLE_CLASS);
        this.#bubble.classList.add(TOOLTIP_VISIBLE_CLASS);
        return this;
    }

    /**
     * Hides the tooltip bubble.
     */
    close() {
        this.#visible = false;
        this.get().classList.remove(TOOLTIP_VISIBLE_CLASS);
        this.#bubble.classList.remove(TOOLTIP_VISIBLE_CLASS);
        return this;
    }

    /**
     * Clears listeners and resets visibility before disposal.
     */
    destroy() {
        this.close();
        this.#trigger.remove();
        this.#bubble.remove();
        return super.destroy();
    }

    /**
     * Mounts the floating bubble at the document level to avoid clipping.
     */
    #mountBubble() {
        if (!this.#bubble.isConnected) {
            document.body.appendChild(this.#bubble);
        }
    }

    /**
     * Synchronizes the floating bubble position with the trigger geometry.
     */
    #syncPosition() {
        if (!this.#visible || !this.#bubble.isConnected) {
            return;
        }

        const triggerRect = this.#trigger.getBoundingClientRect();
        const bubbleRect = this.#bubble.getBoundingClientRect();
        const bubbleWidth = bubbleRect.width;
        const bubbleHeight = bubbleRect.height;
        const centerX = triggerRect.left + (triggerRect.width / 2);

        const unclampedLeft = centerX - (bubbleWidth / 2);
        const left = Math.min(
            Math.max(unclampedLeft, TOOLTIP_VIEWPORT_PADDING),
            window.innerWidth - TOOLTIP_VIEWPORT_PADDING - bubbleWidth,
        );

        const preferredPlacement = this.#placement;
        const canShowAbove = triggerRect.top - bubbleHeight - TOOLTIP_GAP >= TOOLTIP_VIEWPORT_PADDING;
        const canShowBelow = triggerRect.bottom + bubbleHeight + TOOLTIP_GAP <= window.innerHeight - TOOLTIP_VIEWPORT_PADDING;
        const resolvedPlacement = preferredPlacement === 'top'
            ? (canShowAbove || !canShowBelow ? 'top' : 'bottom')
            : (canShowBelow || !canShowAbove ? 'bottom' : 'top');

        const top = resolvedPlacement === 'top'
            ? triggerRect.top - bubbleHeight - TOOLTIP_GAP
            : triggerRect.bottom + TOOLTIP_GAP;
        const arrowLeft = Math.min(
            Math.max(centerX - left, 18),
            bubbleWidth - 18,
        );

        this.#applyBubblePlacementClass(resolvedPlacement);
        this.#bubble.style.left = `${Math.round(left)}px`;
        this.#bubble.style.top = `${Math.round(top)}px`;
        this.#bubble.style.setProperty('--tooltip-arrow-left', `${Math.round(arrowLeft)}px`);
    }

    /**
     * Applies the active placement modifier to the floating bubble element.
     */
    #applyBubblePlacementClass(placement) {
        this.#bubble.classList.toggle('tooltip__bubble--top', placement === 'top');
        this.#bubble.classList.toggle('tooltip__bubble--bottom', placement === 'bottom');
    }
}