import { BaseComponent } from './base-component.js';

export class StatusAlert extends BaseComponent {
	constructor(element) {
		super(element);
	}

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
