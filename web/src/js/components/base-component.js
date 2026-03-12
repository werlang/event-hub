export class BaseComponent {
	#element;
	#subscriptions = [];

	/**
	 * Creates a wrapper around a DOM element.
	 */
	constructor(element = null) {
		this.#element = element;
	}

	/**
	 * Returns the wrapped DOM element.
	 */
	get() {
		return this.#element;
	}

	/**
	 * Replaces the wrapped DOM element.
	 */
	setElement(element) {
		this.#element = element;
		return this;
	}

	/**
	 * Reports whether the component has a usable DOM element.
	 */
	isReady() {
		return Boolean(this.#element);
	}

	/**
	 * Registers a DOM event listener and tracks it for cleanup.
	 */
	on(target, eventName, listener, options) {
		if (!target || typeof target.addEventListener !== 'function' || typeof listener !== 'function') {
			return this;
		}

		target.addEventListener(eventName, listener, options);
		this.#subscriptions.push({ target, eventName, listener, options });
		return this;
	}

	/**
	 * Removes every listener registered through this component.
	 */
	clearListeners() {
		this.#subscriptions.forEach(({ target, eventName, listener, options }) => {
			target.removeEventListener(eventName, listener, options);
		});

		this.#subscriptions = [];
		return this;
	}

	/**
	 * Replaces the wrapped element text content.
	 */
	setText(text = '') {
		if (this.isReady()) {
			this.#element.textContent = text;
		}

		return this;
	}

	/**
	 * Shows or hides the wrapped element.
	 */
	setHidden(hidden) {
		if (this.isReady()) {
			this.#element.hidden = Boolean(hidden);
		}

		return this;
	}

	/**
	 * Toggles a class on the wrapped element.
	 */
	toggleClass(className, force) {
		if (this.isReady()) {
			this.#element.classList.toggle(className, force);
		}

		return this;
	}

	/**
	 * Destroys the component by clearing tracked listeners.
	 */
	destroy() {
		return this.clearListeners();
	}
}