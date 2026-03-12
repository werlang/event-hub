import { BaseComponent } from './base-component.js';

export class SessionBadge extends BaseComponent {
	/**
	 * Creates a wrapper around the session badge element.
	 */
	constructor(element) {
		super(element);
	}

	/**
	 * Shows the transient state used while validating a session.
	 */
	setChecking() {
		return this.#setState('Verificando sessão...', { isActive: false });
	}

	/**
	 * Shows the anonymous-session badge state.
	 */
	setAnonymous() {
		return this.#setState('Sessão não iniciada', { isActive: false });
	}

	/**
	 * Shows the authenticated-session badge state.
	 */
	setActive(name) {
		const label = name ? `Sessão ativa: ${name}` : 'Sessão ativa';
		return this.#setState(label, { isActive: true });
	}

	/**
	 * Applies the session badge label and active styling.
	 */
	#setState(text, { isActive }) {
		if (!this.isReady()) {
			return this;
		}

		this.setText(text);
		this.toggleClass('session-badge--active', Boolean(isActive));
		return this;
	}
}
