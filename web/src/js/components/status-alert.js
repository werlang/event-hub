import { BaseComponent } from './base-component.js';

export class StatusAlert extends BaseComponent {
	/**
	 * Creates a wrapper around a status-alert element.
	 */
	constructor(element) {
		super(element);
	}

	/**
	 * Shows the alert with either success or error styling.
	 */
	show(message, { isError = true } = {}) {
		if (!this.isReady()) {
			return this;
		}

		this.setHidden(false);
		this.setText(message || '');
		this.toggleClass('alert--error', Boolean(isError));
		this.toggleClass('alert--success', !isError);
		return this;
	}

	/**
	 * Hides the alert and clears any previous message styling.
	 */
	hide() {
		if (!this.isReady()) {
			return this;
		}

		this.setHidden(true);
		this.setText('');
		this.get().classList.remove('alert--error', 'alert--success');
		return this;
	}
}
