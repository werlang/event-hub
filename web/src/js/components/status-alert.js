export class StatusAlert {
	constructor(element) {
		this.element = element;
	}

	show(message, { isError = true } = {}) {
		if (!this.element) {
			return;
		}

		this.element.hidden = false;
		this.element.textContent = message;
		this.element.classList.toggle('alert--error', isError);
		this.element.classList.toggle('alert--success', !isError);
	}

	hide() {
		if (!this.element) {
			return;
		}

		this.element.hidden = true;
		this.element.textContent = '';
		this.element.classList.remove('alert--error', 'alert--success');
	}
}
