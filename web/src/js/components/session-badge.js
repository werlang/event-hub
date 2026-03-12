import { BaseComponent } from './base-component.js';

export class SessionBadge extends BaseComponent {
	constructor(element) {
		super(element);
	}

	setChecking() {
		return this.#setState('Verificando sessão...', { isActive: false });
	}

	setAnonymous() {
		return this.#setState('Sessão não iniciada', { isActive: false });
	}

	setActive(name) {
		const label = name ? `Sessão ativa: ${name}` : 'Sessão ativa';
		return this.#setState(label, { isActive: true });
	}

	#setState(text, { isActive }) {
		if (!this.isReady()) {
			return this;
		}

		this.setText(text);
		this.toggleClass('session-badge--active', Boolean(isActive));
		return this;
	}
}
