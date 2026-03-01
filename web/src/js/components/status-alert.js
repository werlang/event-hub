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
		this.element.style.borderColor = isError
			? 'rgba(250, 204, 21, 0.5)'
			: 'rgba(34, 197, 94, 0.6)';
		this.element.style.background = isError
			? 'rgba(250, 204, 21, 0.14)'
			: 'rgba(34, 197, 94, 0.15)';
		this.element.style.color = isError ? '#fde68a' : '#bbf7d0';
	}

	hide() {
		if (!this.element) {
			return;
		}

		this.element.hidden = true;
		this.element.textContent = '';
	}
}
