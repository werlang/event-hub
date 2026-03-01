export class AuthTabs {
	constructor({ tabs = [], loginForm = null, registerForm = null }) {
		this.tabs = tabs;
		this.loginForm = loginForm;
		this.registerForm = registerForm;
		this.registerEnabled = false;
	}

	setActive(tabName) {
		if (tabName === 'register' && !this.registerEnabled) {
			tabName = 'login';
		}

		this.tabs.forEach(button => {
			button.classList.toggle('tab--active', button.dataset.tab === tabName);
		});

		if (this.loginForm) {
			this.loginForm.classList.toggle('form--visible', tabName === 'login');
		}
		if (this.registerForm) {
			this.registerForm.classList.toggle('form--visible', tabName === 'register');
		}
	}

	setRegisterEnabled(isEnabled) {
		this.registerEnabled = Boolean(isEnabled);

		this.tabs.forEach(button => {
			if (button.dataset.tab !== 'register') {
				return;
			}

			button.classList.toggle('tab--disabled', !this.registerEnabled);
			button.setAttribute('aria-disabled', this.registerEnabled ? 'false' : 'true');
		});

		if (!this.registerForm) {
			return;
		}

		this.registerForm.classList.toggle('form--disabled', !this.registerEnabled);
		this.registerForm.setAttribute('aria-disabled', this.registerEnabled ? 'false' : 'true');
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
