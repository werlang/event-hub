import { BaseComponent } from '../components/base-component.js';

/**
 * Returns the configured tab name for one dashboard action button.
 */
function readTabName(button) {
    return String(button?.dataset?.dashboardActionTab || '').trim().toLowerCase();
}

/**
 * Controls the horizontal action tabs shown as a dashboard subheader.
 */
export class DashboardActionTabs extends BaseComponent {
    #tabs;
    #activeTab = 'browse';
    #onAction;

    /**
     * Creates the dashboard action-tabs controller.
     */
    constructor({ tabList = null, tabs = [], onAction = null } = {}) {
        super(tabList || tabs[0]?.parentElement || null);
        this.#tabs = Array.isArray(tabs) ? tabs.filter(Boolean) : [];
        this.#onAction = typeof onAction === 'function' ? onAction : null;
    }

    /**
     * Reports whether the action row has all required buttons.
     */
    isReady() {
        return super.isReady()
            && this.#readVisibleTabs().length >= 1;
    }

    /**
     * Marks one action tab as the current dashboard view.
     */
    setActive(tabName) {
        if (!this.isReady()) {
            return this;
        }

        this.#activeTab = this.#normalizeTab(tabName);
        this.#syncTabs();
        return this;
    }

    /**
     * Executes the action associated with one dashboard subheader tab.
     */
    async activate(tabName) {
        const normalizedTab = this.#normalizeTab(tabName);
        const nextActiveTab = await this.#onAction?.(normalizedTab, this.#activeTab);
        this.setActive(nextActiveTab || this.#activeTab);
        return this;
    }

    /**
     * Wires click and keyboard behavior for the dashboard action row.
     */
    wire() {
        if (!this.isReady()) {
            return this;
        }

        this.destroy();

        this.on(this.get(), 'click', (event) => {
            const button = event.target instanceof Element
                ? event.target.closest('[data-dashboard-action-tab]')
                : null;
            if (!button || !this.#tabs.includes(button)) {
                return;
            }

            void this.activate(button.dataset.dashboardActionTab);
        });

        this.on(this.get(), 'keydown', (event) => {
            const button = event.target instanceof Element
                ? event.target.closest('[data-dashboard-action-tab]')
                : null;
            if (!button || !this.#tabs.includes(button)) {
                return;
            }

            switch (event.key) {
            case 'ArrowRight':
            case 'ArrowDown':
                event.preventDefault();
                this.#focusRelativeTab(button, 1);
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
                event.preventDefault();
                this.#focusRelativeTab(button, -1);
                break;
            case 'Home':
                event.preventDefault();
                this.#readVisibleTabs()[0]?.focus();
                break;
            case 'End':
                event.preventDefault();
                this.#readVisibleTabs().at(-1)?.focus();
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                void this.activate(button.dataset.dashboardActionTab);
                break;
            default:
                break;
            }
        });

        this.setActive(this.#activeTab);
        return this;
    }

    /**
     * Normalizes a raw tab name into a supported dashboard action tab.
     */
    #normalizeTab(tabName) {
        const normalizedTab = String(tabName || '').trim().toLowerCase();
        const hasMatchingTab = this.#tabs.some(button => readTabName(button) === normalizedTab);

        if (hasMatchingTab) {
            return normalizedTab;
        }

        return readTabName(this.#readVisibleTabs()[0]) || readTabName(this.#tabs[0]);
    }

    /**
     * Moves focus relative to the current action tab.
     */
    #focusRelativeTab(currentButton, direction) {
        const visibleTabs = this.#readVisibleTabs();
        const currentIndex = Math.max(visibleTabs.indexOf(currentButton), 0);
        const nextIndex = (currentIndex + direction + visibleTabs.length) % visibleTabs.length;
        visibleTabs[nextIndex]?.focus();
    }

    /**
     * Synchronizes button state with the current active action tab.
     */
    #syncTabs() {
        this.#tabs.forEach((button) => {
            const isActive = this.#normalizeTab(readTabName(button)) === this.#activeTab;
            button.classList.toggle('dashboard-action-tab--current', isActive);
        });
    }

    /**
     * Returns only the currently visible dashboard action tabs.
     */
    #readVisibleTabs() {
        return this.#tabs.filter(button => !button.hidden);
    }
}

export default DashboardActionTabs;