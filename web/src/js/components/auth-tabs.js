import { setFormEnabled } from './form-state.js';

export class AuthTabs {
	constructor({ tabs = [], loginForm = null, registerForm = null, onChange = null }) {
		this.tabs = tabs;
		this.loginForm = loginForm;
		this.registerForm = registerForm;
		this.registerEnabled = false;
		this.activeTab = 'login';
		this.onChange = typeof onChange === 'function' ? onChange : null;
	}

	setActive(tabName) {
		if (tabName === 'register' && !this.registerEnabled) {
			tabName = 'login';
		}

		this.activeTab = tabName === 'register' ? 'register' : 'login';

		this.tabs.forEach(button => {
			const isActive = button.dataset.tab === this.activeTab;
			button.classList.toggle('tab--active', isActive);
			button.setAttribute('aria-selected', isActive ? 'true' : 'false');
			button.setAttribute('tabindex', isActive ? '0' : '-1');
		});

		if (this.loginForm) {
			const isLoginActive = this.activeTab === 'login';
			this.loginForm.classList.toggle('form--visible', isLoginActive);
			this.loginForm.setAttribute('aria-hidden', isLoginActive ? 'false' : 'true');
			setFormEnabled(this.loginForm, isLoginActive);
		}

		if (this.registerForm) {
			const isRegisterActive = this.activeTab === 'register';
			this.registerForm.classList.toggle('form--visible', isRegisterActive);
			this.registerForm.setAttribute('aria-hidden', isRegisterActive ? 'false' : 'true');
			setFormEnabled(this.registerForm, isRegisterActive && this.registerEnabled);
		}

		this.onChange?.(this.activeTab);
	}

	setRegisterEnabled(isEnabled) {
		this.registerEnabled = Boolean(isEnabled);

		this.tabs.forEach(button => {
			if (button.dataset.tab !== 'register') {
				return;
			}

			button.classList.toggle('tab--disabled', !this.registerEnabled);
			button.disabled = !this.registerEnabled;
			button.setAttribute('aria-disabled', this.registerEnabled ? 'false' : 'true');
		});

		if (!this.registerForm) {
			return;
		}

		this.registerForm.setAttribute('aria-disabled', this.registerEnabled ? 'false' : 'true');

		if (!this.registerEnabled && this.activeTab === 'register') {
			this.setActive('login');
			return;
		}

		setFormEnabled(this.registerForm, this.registerEnabled && this.activeTab === 'register');
	}

	wire() {
		this.tabs.forEach(button => {
			button.addEventListener('click', () => {
				if (button.dataset.tab === 'register' && !this.registerEnabled) {
					this.setActive('login');
					return;
				}

				this.setActive(button.dataset.tab || 'login');
			});
		});
	}
}
