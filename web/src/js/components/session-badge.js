export class SessionBadge {
	constructor(element) {
		this.element = element;
	}

	setChecking() {
		this.#setState('Verificando sessão...', { isActive: false });
	}

	setAnonymous() {
		this.#setState('Sessão não iniciada', { isActive: false });
	}

	setActive(name) {
		const label = name ? `Sessão ativa: ${name}` : 'Sessão ativa';
		this.#setState(label, { isActive: true });
	}

	#setState(text, { isActive }) {
		if (!this.element) {
			return;
		}

		this.element.textContent = text;
		this.element.classList.toggle('session-badge--active', Boolean(isActive));
	}
}
