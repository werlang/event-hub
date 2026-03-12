export class BaseComponent {
	#element;
	#subscriptions = [];

	constructor(element = null) {
		this.#element = element;
	}

	get() {
		return this.#element;
	}

	setElement(element) {
		this.#element = element;
		return this;
	}

	isReady() {
		return Boolean(this.#element);
	}

	on(target, eventName, listener, options) {
		if (!target || typeof target.addEventListener !== 'function' || typeof listener !== 'function') {
			return this;
		}

		target.addEventListener(eventName, listener, options);
		this.#subscriptions.push({ target, eventName, listener, options });
		return this;
	}

	clearListeners() {
		this.#subscriptions.forEach(({ target, eventName, listener, options }) => {
			target.removeEventListener(eventName, listener, options);
		});

		this.#subscriptions = [];
		return this;
	}

	setText(text = '') {
		if (this.isReady()) {
			this.#element.textContent = text;
		}

		return this;
	}

	setHidden(hidden) {
		if (this.isReady()) {
			this.#element.hidden = Boolean(hidden);
		}

		return this;
	}

	toggleClass(className, force) {
		if (this.isReady()) {
			this.#element.classList.toggle(className, force);
		}

		return this;
	}

	destroy() {
		return this.clearListeners();
	}
}