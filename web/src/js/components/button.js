import { BaseComponent } from './base-component.js';

/**
 * Normalizes a class list input into an array of class names.
 */
function normalizeClassList(customClass) {
	if (!customClass) {
		return [];
	}

	return Array.isArray(customClass) ? customClass.filter(Boolean) : [customClass];
}

/**
 * Expands an icon descriptor into the classes needed for rendering.
 */
function normalizeIconClasses(icon) {
	if (typeof icon !== 'string' || !icon.trim()) {
		return [];
	}

	if (icon.includes(' ')) {
		return icon.trim().split(/\s+/);
	}

	return ['fa-solid', `fa-${icon.trim()}`];
}

export class Button extends BaseComponent {
	#idleMarkup = '';
	#busy = false;
	#loadingLabel = 'Carregando...';

	/**
	 * Creates a button wrapper and applies its initial presentation.
	 */
	constructor({ element, text, callback, customClass, icon, title, loadingLabel } = {}) {
		super(element || document.createElement('button'));

		if (typeof loadingLabel === 'string' && loadingLabel.trim()) {
			this.#loadingLabel = loadingLabel.trim();
		}

		if (text || icon) {
			this.setContent({ text, icon });
		} else {
			this.#snapshotIdleMarkup();
		}

		if (title) {
			this.get().setAttribute('title', title);
		}

		normalizeClassList(customClass).forEach(className => {
			this.get().classList.add(className);
		});

		if (callback) {
			this.click(callback);
		}
	}

	/**
	 * Reports whether the button is currently showing a busy state.
	 */
	get isBusy() {
		return this.#busy;
	}

	/**
	 * Replaces the button label text.
	 */
	setText(text) {
		return this.setContent({ text });
	}

	/**
	 * Replaces the button HTML and stores it as the idle markup.
	 */
	setHtml(html) {
		this.get().innerHTML = typeof html === 'string' ? html : '';
		this.#snapshotIdleMarkup();
		return this;
	}

	/**
	 * Rebuilds the button content using text and optional icon metadata.
	 */
	setContent({ text = '', icon = null } = {}) {
		const element = this.get();
		element.replaceChildren();

		const iconClasses = normalizeIconClasses(icon);
		if (iconClasses.length) {
			const iconElement = document.createElement('i');
			iconElement.classList.add(...iconClasses);
			iconElement.setAttribute('aria-hidden', 'true');
			element.appendChild(iconElement);
		}

		if (typeof text === 'string' && text.length > 0) {
			if (iconClasses.length) {
				element.appendChild(document.createTextNode(' '));
			}

			const label = document.createElement('span');
			label.textContent = text;
			element.appendChild(label);
		}

		this.#snapshotIdleMarkup();
		return this;
	}

	/**
	 * Sets the label used while the button is busy.
	 */
	setLoadingLabel(label) {
		if (typeof label === 'string' && label.trim()) {
			this.#loadingLabel = label.trim();
		}

		return this;
	}

	/**
	 * Adds one or more classes to the button element.
	 */
	addClass(classList) {
		normalizeClassList(classList).forEach(className => {
			this.get().classList.add(className);
		});

		return this;
	}

	/**
	 * Removes one or more classes from the button element.
	 */
	removeClass(classList) {
		normalizeClassList(classList).forEach(className => {
			this.get().classList.remove(className);
		});

		return this;
	}

	/**
	 * Toggles the native disabled state for the button.
	 */
	setDisabled(disabled) {
		this.get().disabled = Boolean(disabled);
		return this;
	}

	/**
	 * Disables the button and optionally switches it into busy mode.
	 */
	disable({ showBusy = false } = {}) {
		this.setDisabled(true);

		if (showBusy && !this.#busy) {
			this.#snapshotIdleMarkup();
			this.#busy = true;
			this.get().dataset.buttonBusy = 'true';

			const spinner = document.createElement('i');
			spinner.className = 'fa-solid fa-spinner fa-spin';
			spinner.setAttribute('aria-hidden', 'true');

			const label = document.createElement('span');
			label.textContent = this.#loadingLabel;

			this.get().replaceChildren(spinner, label);
		}

		return this;
	}

	/**
	 * Restores the button from busy mode and enables it again.
	 */
	enable() {
		if (this.#busy) {
			this.get().innerHTML = this.#idleMarkup;
			delete this.get().dataset.buttonBusy;
			this.#busy = false;
		}

		this.setDisabled(false);
		return this;
	}

	/**
	 * Binds a click handler and optionally manages the busy state automatically.
	 */
	click(callback, { manageBusy = true } = {}) {
		if (typeof callback !== 'function') {
			this.get().click();
			return this;
		}

		this.on(this.get(), 'click', async (event) => {
			if (manageBusy) {
				this.disable({ showBusy: true });
			}

			try {
				await callback(event, this);
			} finally {
				if (manageBusy) {
					this.enable();
				}
			}
		});

		return this;
	}

	/**
	 * Stores the current button markup for later busy-state restoration.
	 */
	#snapshotIdleMarkup() {
		if (!this.#busy) {
			this.#idleMarkup = this.get().innerHTML;
		}
	}
}