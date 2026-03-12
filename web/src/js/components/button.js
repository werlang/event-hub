import { BaseComponent } from './base-component.js';

function normalizeClassList(customClass) {
	if (!customClass) {
		return [];
	}

	return Array.isArray(customClass) ? customClass.filter(Boolean) : [customClass];
}

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

	get isBusy() {
		return this.#busy;
	}

	setText(text) {
		return this.setContent({ text });
	}

	setHtml(html) {
		this.get().innerHTML = typeof html === 'string' ? html : '';
		this.#snapshotIdleMarkup();
		return this;
	}

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

	setLoadingLabel(label) {
		if (typeof label === 'string' && label.trim()) {
			this.#loadingLabel = label.trim();
		}

		return this;
	}

	addClass(classList) {
		normalizeClassList(classList).forEach(className => {
			this.get().classList.add(className);
		});

		return this;
	}

	removeClass(classList) {
		normalizeClassList(classList).forEach(className => {
			this.get().classList.remove(className);
		});

		return this;
	}

	setDisabled(disabled) {
		this.get().disabled = Boolean(disabled);
		return this;
	}

	disable({ showBusy = false } = {}) {
		this.setDisabled(true);

		if (showBusy && !this.#busy) {
			this.#snapshotIdleMarkup();
			this.#busy = true;
			this.get().dataset.buttonBusy = 'true';
			this.get().textContent = this.#loadingLabel;
		}

		return this;
	}

	enable() {
		if (this.#busy) {
			this.get().innerHTML = this.#idleMarkup;
			delete this.get().dataset.buttonBusy;
			this.#busy = false;
		}

		this.setDisabled(false);
		return this;
	}

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

	#snapshotIdleMarkup() {
		if (!this.#busy) {
			this.#idleMarkup = this.get().innerHTML;
		}
	}
}