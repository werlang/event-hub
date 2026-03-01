export class AuthTabs {
	constructor({ tabs = [], loginForm = null, registerForm = null }) {
		this.tabs = tabs;
		this.loginForm = loginForm;
		this.registerForm = registerForm;
	}

	setActive(tabName) {
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

	wire() {
		this.tabs.forEach(button => {
			button.addEventListener('click', () => {
				this.setActive(button.dataset.tab || 'login');
			});
		});
	}
}
