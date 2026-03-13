import { BaseComponent } from './base-component.js';

export class HeaderSessionNav extends BaseComponent {
	#loginLink;
	#dashboardLink;

	/**
	 * Queries the shared header session controls from the current document.
	 */
	static fromDocument(root = document) {
		return new HeaderSessionNav({
			surface: root.querySelector('#header-auth-surface'),
			loginLink: root.querySelector('#header-login-link'),
			dashboardLink: root.querySelector('#header-dashboard-link'),
		});
	}

	/**
	 * Creates a wrapper around the shared header session controls.
	 */
	constructor({ surface, loginLink, dashboardLink }) {
		super(surface ?? null);
		this.#loginLink = loginLink ?? null;
		this.#dashboardLink = dashboardLink ?? null;
	}

	/**
	 * Reports whether the full header session UI is available.
	 */
	isReady() {
		return super.isReady()
			&& Boolean(this.#loginLink)
			&& Boolean(this.#dashboardLink);
	}

	/**
	 * Shows the transient validation state used while the session is being resolved.
	 */
	setChecking() {
		if (!this.isReady()) {
			return this;
		}

		this.get().dataset.sessionState = 'checking';
		this.#loginLink.hidden = true;
		this.#dashboardLink.hidden = true;
		this.#dashboardLink.removeAttribute('aria-current');
		return this;
	}

	/**
	 * Shows the anonymous-session navigation state.
	 */
	setAnonymous({ loginHref }) {
		if (!this.isReady()) {
			return this;
		}

		this.get().dataset.sessionState = 'anonymous';
		this.#dashboardLink.hidden = true;
		this.#dashboardLink.removeAttribute('aria-current');
		this.#loginLink.hidden = false;
		this.#loginLink.href = loginHref || '/login';
		return this;
	}

	/**
	 * Shows the authenticated-session navigation state.
	 */
	setAuthenticated({ dashboardHref = '/dashboard', isCurrentPage = false } = {}) {
		if (!this.isReady()) {
			return this;
		}

		this.get().dataset.sessionState = 'authenticated';
		this.#loginLink.hidden = true;
		this.#dashboardLink.hidden = false;
		this.#dashboardLink.href = dashboardHref;

		if (isCurrentPage) {
			this.#dashboardLink.setAttribute('aria-current', 'page');
			return this;
		}

		this.#dashboardLink.removeAttribute('aria-current');
		return this;
	}
}