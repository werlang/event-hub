import { BaseComponent } from './base-component.js';
import { createFormState } from './form-state.js';

const LOGIN_TAB = 'login';
const REGISTER_TAB = 'register';

export class AuthTabs extends BaseComponent {
	#tabs;
	#formStates;
	#registerEnabled = false;
	#activeTab = LOGIN_TAB;
	#onChange;

	constructor({ tabs = [], loginForm = null, registerForm = null, onChange = null }) {
		super(tabs[0]?.closest('[role="tablist"]') || tabs[0]?.parentElement || null);
		this.#tabs = Array.isArray(tabs) ? tabs.filter(Boolean) : [];
		this.#formStates = {
			login: createFormState(loginForm),
			register: createFormState(registerForm),
		};
		this.#onChange = typeof onChange === 'function' ? onChange : null;
	}

	get activeTab() {
		return this.#activeTab;
	}

	isReady() {
		return super.isReady()
			&& this.#tabs.length > 0
			&& this.#formStates.login.isReady()
			&& this.#formStates.register.isReady();
	}

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

			this.setActive(button.dataset.tab);
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
				this.setActive(button.dataset.tab);
				break;
			default:
				break;
			}
		});

		return this;
	}

	#normalizeTab(tabName) {
		return tabName === REGISTER_TAB ? REGISTER_TAB : LOGIN_TAB;
	}

	#getEnabledTabs() {
		return this.#tabs.filter(button => !button.disabled);
	}

	#getTab(tabName) {
		return this.#tabs.find(button => this.#normalizeTab(button.dataset.tab) === tabName) || null;
	}

	#focusRelativeTab(currentButton, direction) {
		const enabledTabs = this.#getEnabledTabs();
		if (!enabledTabs.length) {
			return;
		}

		const currentIndex = Math.max(enabledTabs.indexOf(currentButton), 0);
		const nextIndex = (currentIndex + direction + enabledTabs.length) % enabledTabs.length;
		enabledTabs[nextIndex].focus();
	}

	#focusFirstTab() {
		this.#getEnabledTabs()[0]?.focus();
	}

	#focusLastTab() {
		const enabledTabs = this.#getEnabledTabs();
		enabledTabs.at(-1)?.focus();
	}

	#syncTabs() {
		this.#tabs.forEach((button) => {
			const tabName = this.#normalizeTab(button.dataset.tab);
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

	#syncForms() {
		const loginForm = this.#formStates.login.get();
		const registerForm = this.#formStates.register.get();

		const isLoginActive = this.#activeTab === LOGIN_TAB;
		loginForm.classList.toggle('form--visible', isLoginActive);
		loginForm.hidden = !isLoginActive;
		loginForm.setAttribute('aria-hidden', isLoginActive ? 'false' : 'true');
		this.#formStates.login.setEnabled(isLoginActive);

		const isRegisterActive = this.#activeTab === REGISTER_TAB && this.#registerEnabled;
		registerForm.classList.toggle('form--visible', isRegisterActive);
		registerForm.hidden = !isRegisterActive;
		registerForm.setAttribute('aria-hidden', isRegisterActive ? 'false' : 'true');
		this.#formStates.register.setEnabled(isRegisterActive);

		this.#getTab(this.#activeTab)?.focus({ preventScroll: true });
	}
}
