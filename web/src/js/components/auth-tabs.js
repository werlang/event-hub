import { BaseComponent } from './base-component.js';
import { Form } from './form.js';

const LOGIN_TAB = 'login';
const REGISTER_TAB = 'register';
const VISIBILITY_STATE_KEY = 'visibility';

/**
 * Normalizes a form input into a Form instance.
 */
function normalizeForm(form) {
	return form instanceof Form ? form : new Form(form);
}

export class AuthTabs extends BaseComponent {
    #tabs;
    #tabNameByButton = new Map();
    #forms;
    #registerEnabled = false;
    #activeTab = LOGIN_TAB;
    #onChange;

	/**
	 * Creates the auth tab controller for the login and register forms.
	 */
    constructor({ tabs = [], loginForm = null, registerForm = null, onChange = null }) {
        super(tabs[0]?.closest('[role="tablist"]') || tabs[0]?.parentElement || null);
        this.#tabs = Array.isArray(tabs) ? tabs.filter(Boolean) : [];
        this.#tabs.forEach((button) => {
            this.#tabNameByButton.set(button, this.#normalizeTab(button.dataset.tab));
        });
        this.#forms = {
			login: normalizeForm(loginForm),
			register: normalizeForm(registerForm),
		};
		this.#onChange = typeof onChange === 'function' ? onChange : null;
	}

	/**
	 * Returns the currently active auth tab name.
	 */
	get activeTab() {
		return this.#activeTab;
	}

	/**
	 * Reports whether the tab list and both forms are available.
	 */
	isReady() {
		return super.isReady()
			&& this.#tabs.length > 0
			&& this.#forms.login.isReady()
			&& this.#forms.register.isReady();
	}

	/**
	 * Activates one of the auth tabs and syncs the UI state.
	 */
	setActive(tabName) {
		if (!this.isReady()) {
			return this;
		}

		const nextTab = this.#normalizeTab(tabName);
		const normalizedTab = nextTab === REGISTER_TAB && this.#registerEnabled ? REGISTER_TAB : LOGIN_TAB;
		const didChange = this.#activeTab !== normalizedTab;
		this.#activeTab = normalizedTab;

		this.#syncTabs();
		this.#syncForms();

		if (didChange) {
			this.#onChange?.(this.#activeTab);
		}

		return this;
	}

	/**
	 * Enables or disables access to the register tab.
	 */
	setRegisterEnabled(isEnabled) {
		const previousActiveTab = this.#activeTab;
		this.#registerEnabled = Boolean(isEnabled);

		if (!this.#registerEnabled && this.#activeTab === REGISTER_TAB) {
			this.#activeTab = LOGIN_TAB;
		}

		this.#syncTabs();
		this.#syncForms();

		if (previousActiveTab !== this.#activeTab) {
			this.#onChange?.(this.#activeTab);
		}

		return this;
	}

	/**
	 * Binds click and keyboard behavior for the auth tab list.
	 */
	wire() {
		if (!this.isReady()) {
			return this;
		}

        this.destroy();
        this.on(this.get(), 'click', (event) => {
            const button = event.target.closest('[data-tab]');
            if (!button || !this.#tabs.includes(button)) {
                return;
            }

            this.setActive(this.#tabNameByButton.get(button) || LOGIN_TAB);
        });

        this.on(this.get(), 'keydown', (event) => {
            const button = event.target.closest('[data-tab]');
            if (!button || !this.#tabs.includes(button)) {
                return;
            }

            switch (event.key) {
            case 'ArrowRight':
                event.preventDefault();
                this.#focusRelativeTab(button, 1);
                break;
            case 'ArrowLeft':
                event.preventDefault();
                this.#focusRelativeTab(button, -1);
                break;
            case 'Home':
                event.preventDefault();
                this.#focusFirstTab();
                break;
            case 'End':
                event.preventDefault();
                this.#focusLastTab();
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                this.setActive(this.#tabNameByButton.get(button) || LOGIN_TAB);
                break;
			default:
				break;
			}
		});

		return this;
	}

	/**
	 * Normalizes an arbitrary tab name into a supported auth tab.
	 */
	#normalizeTab(tabName) {
		return tabName === REGISTER_TAB ? REGISTER_TAB : LOGIN_TAB;
	}

	/**
	 * Returns the tabs that are currently interactive.
	 */
	#getEnabledTabs() {
		return this.#tabs.filter(button => !button.disabled);
	}

	/**
	 * Returns the tab button matching a normalized tab name.
	 */
    #getTab(tabName) {
        return this.#tabs.find(button => this.#tabNameByButton.get(button) === tabName) || null;
    }

	/**
	 * Moves focus to the next enabled tab relative to the current one.
	 */
	#focusRelativeTab(currentButton, direction) {
		const enabledTabs = this.#getEnabledTabs();
		if (!enabledTabs.length) {
			return;
		}

		const currentIndex = Math.max(enabledTabs.indexOf(currentButton), 0);
		const nextIndex = (currentIndex + direction + enabledTabs.length) % enabledTabs.length;
		enabledTabs[nextIndex].focus();
	}

	/**
	 * Moves focus to the first enabled auth tab.
	 */
	#focusFirstTab() {
		this.#getEnabledTabs()[0]?.focus();
	}

	/**
	 * Moves focus to the last enabled auth tab.
	 */
	#focusLastTab() {
		const enabledTabs = this.#getEnabledTabs();
		enabledTabs.at(-1)?.focus();
	}

	/**
	 * Synchronizes the selected and disabled states for every tab button.
	 */
    #syncTabs() {
        this.#tabs.forEach((button) => {
            const tabName = this.#tabNameByButton.get(button) || LOGIN_TAB;
            const isDisabled = tabName === REGISTER_TAB && !this.#registerEnabled;
			const isActive = tabName === this.#activeTab;

			button.classList.toggle('tab--active', isActive);
			button.classList.toggle('tab--disabled', isDisabled);
			button.disabled = isDisabled;
			button.setAttribute('aria-disabled', isDisabled ? 'true' : 'false');
			button.setAttribute('aria-selected', isActive ? 'true' : 'false');
			button.setAttribute('tabindex', isActive && !isDisabled ? '0' : '-1');
		});
	}

	/**
	 * Synchronizes form visibility and accessibility with the active tab.
	 */
	#syncForms() {
		const loginForm = this.#forms.login;
		const registerForm = this.#forms.register;
		const loginFormElement = loginForm.get();
		const registerFormElement = registerForm.get();

		const isLoginActive = this.#activeTab === LOGIN_TAB;
		loginFormElement.classList.toggle('form--visible', isLoginActive);
		loginFormElement.hidden = !isLoginActive;
		loginFormElement.setAttribute('aria-hidden', isLoginActive ? 'false' : 'true');
		loginForm.setEnabled(isLoginActive, { stateKey: VISIBILITY_STATE_KEY });

		const isRegisterActive = this.#activeTab === REGISTER_TAB && this.#registerEnabled;
		registerFormElement.classList.toggle('form--visible', isRegisterActive);
		registerFormElement.hidden = !isRegisterActive;
		registerFormElement.setAttribute('aria-hidden', isRegisterActive ? 'false' : 'true');
		registerForm.setEnabled(isRegisterActive, { stateKey: VISIBILITY_STATE_KEY });

		this.#getTab(this.#activeTab)?.focus({ preventScroll: true });
	}
}
