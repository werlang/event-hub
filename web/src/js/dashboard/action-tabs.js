import { BaseComponent } from '../components/base-component.js';

const DASHBOARD_ACTION_TAB_BROWSE = 'browse';
const DASHBOARD_ACTION_TAB_CREATE = 'create';
const DASHBOARD_ACTION_TAB_SETTINGS = 'settings';

/**
 * Controls the horizontal action tabs shown as a dashboard subheader.
 */
export class DashboardActionTabs extends BaseComponent {
    #tabs;
    #activeTab = DASHBOARD_ACTION_TAB_BROWSE;
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
            && this.#tabs.length === 3;
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
        this.setActive(DASHBOARD_ACTION_TAB_BROWSE);
        await this.#onAction?.(normalizedTab);
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
                this.#tabs[0]?.focus();
                break;
            case 'End':
                event.preventDefault();
                this.#tabs.at(-1)?.focus();
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
        if (tabName === DASHBOARD_ACTION_TAB_CREATE) {
            return DASHBOARD_ACTION_TAB_CREATE;
        }

        if (tabName === DASHBOARD_ACTION_TAB_SETTINGS) {
            return DASHBOARD_ACTION_TAB_SETTINGS;
        }

        return DASHBOARD_ACTION_TAB_BROWSE;
    }

    /**
     * Moves focus relative to the current action tab.
     */
    #focusRelativeTab(currentButton, direction) {
        const currentIndex = Math.max(this.#tabs.indexOf(currentButton), 0);
        const nextIndex = (currentIndex + direction + this.#tabs.length) % this.#tabs.length;
        this.#tabs[nextIndex]?.focus();
    }

    /**
     * Synchronizes button state with the current active action tab.
     */
    #syncTabs() {
        this.#tabs.forEach((button) => {
            const isActive = this.#normalizeTab(button.dataset.dashboardActionTab) === this.#activeTab;
            button.classList.toggle('dashboard-action-tab--current', isActive);
        });
    }
}

export default DashboardActionTabs;