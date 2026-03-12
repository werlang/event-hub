import { BaseComponent } from './base-component.js';

function isString(value) {
	return typeof value === 'string';
}

function isCheckable(field) {
	return field?.tagName === 'INPUT' && (field.type === 'checkbox' || field.type === 'radio');
}

function isTextualField(field) {
	if (!field) {
		return false;
	}

	if (field.tagName === 'TEXTAREA') {
		return true;
	}

	if (field.tagName === 'SELECT') {
		return false;
	}

	if (field.tagName !== 'INPUT') {
		return false;
	}

	return !['checkbox', 'radio', 'file'].includes(field.type);
}

function normalizeBoolean(value) {
	if (typeof value === 'boolean') {
		return value;
	}

	if (typeof value === 'number') {
		return value !== 0;
	}

	if (!isString(value)) {
		return false;
	}

	return ['true', '1', 'on', 'yes'].includes(value.trim().toLowerCase());
}

export class Input extends BaseComponent {
	#mask = null;
	#maskBound = false;

	constructor(element) {
		super(element || document.createElement('input'));
		this.refresh();
	}

	get value() {
		return this.getValue();
	}

	getValue() {
		if (!this.isReady()) {
			return '';
		}

		const field = this.get();
		if (field.tagName === 'INPUT' && field.type === 'checkbox') {
			return field.checked;
		}

		if (field.tagName === 'INPUT' && field.type === 'radio') {
			return field.checked ? field.value : '';
		}

		if (field.tagName === 'SELECT' && field.multiple) {
			return Array.from(field.selectedOptions).map(option => option.value);
		}

		return field.value ?? '';
	}

	setValue(value) {
		if (!this.isReady()) {
			return this;
		}

		const field = this.get();
		if (field.tagName === 'INPUT' && field.type === 'checkbox') {
			field.checked = Array.isArray(value)
				? value.includes(field.value)
				: normalizeBoolean(value);
			return this.refresh();
		}

		if (field.tagName === 'INPUT' && field.type === 'radio') {
			field.checked = Array.isArray(value)
				? value.includes(field.value)
				: String(value ?? '') === field.value;
			return this.refresh();
		}

		if (field.tagName === 'SELECT' && field.multiple && Array.isArray(value)) {
			Array.from(field.options).forEach((option) => {
				option.selected = value.includes(option.value);
			});
			return this.refresh();
		}

		field.value = value == null ? '' : String(value);
		this.#applyMask();
		return this.refresh();
	}

	clear() {
		if (!this.isReady()) {
			return this;
		}

		const field = this.get();
		if (field.tagName === 'INPUT' && ['checkbox', 'radio'].includes(field.type)) {
			field.checked = false;
			return this.refresh();
		}

		field.value = '';
		return this.refresh();
	}

	refresh() {
		if (!this.isReady()) {
			return this;
		}

		const field = this.get();
		const value = this.getValue();
		const filled = Array.isArray(value) ? value.length > 0 : Boolean(value);
		field.classList.toggle('filled', filled);

		if (field.tagName === 'INPUT' && field.type === 'checkbox') {
			field.closest('label.checkbox-field')?.classList.toggle('disabled', field.disabled);
		}

		return this;
	}

	setError(message, { report = false } = {}) {
		if (!this.isReady()) {
			return this;
		}

		const field = this.get();
		field.classList.add('error');
		field.setAttribute('aria-invalid', 'true');

		if (isString(message) && message) {
			field.dataset.errorMessage = message;
			field.setAttribute('title', message);
		}

		if (typeof field.setCustomValidity === 'function') {
			field.setCustomValidity(isString(message) ? message : 'Valor inválido.');
		}

		if (report && typeof field.reportValidity === 'function') {
			field.reportValidity();
		}

		return this;
	}

	clearError() {
		if (!this.isReady()) {
			return this;
		}

		const field = this.get();
		field.classList.remove('error');
		field.removeAttribute('aria-invalid');
		if (field.dataset.errorMessage) {
			delete field.dataset.errorMessage;
			field.removeAttribute('title');
		}

		if (typeof field.setCustomValidity === 'function') {
			field.setCustomValidity('');
		}

		return this;
	}

	keyPress(callback) {
		return this.#bind('keypress', callback);
	}

	keyUp(callback) {
		return this.#bind('keyup', callback);
	}

	input(callback) {
		return this.#bind('input', callback);
	}

	change(callback) {
		return this.#bind('change', callback);
	}

	focus(options) {
		this.get()?.focus(options);
		return this;
	}

	disable() {
		if (this.isReady()) {
			this.get().disabled = true;
		}

		return this.refresh();
	}

	enable() {
		if (this.isReady()) {
			this.get().disabled = false;
		}

		return this.refresh();
	}

	setMask(mask) {
		this.#mask = isString(mask) && mask ? mask : null;

		if (this.#mask && !this.#maskBound && isTextualField(this.get())) {
			this.#maskBound = true;
			this.input(() => this.#applyMask());
			this.change(() => this.#applyMask());
		}

		this.#applyMask();
		return this;
	}

	#bind(eventName, callback) {
		if (!this.isReady() || typeof callback !== 'function') {
			return this;
		}

		this.get().addEventListener(eventName, (event) => {
			this.refresh();
			callback(event, this);
		});

		return this;
	}

	#applyMask() {
		if (!this.#mask || !this.isReady() || !isTextualField(this.get())) {
			return this;
		}

		const field = this.get();
		const value = field.value;
		let output = '';
		let inputIndex = 0;

		for (let maskIndex = 0; maskIndex < this.#mask.length; maskIndex += 1) {
			if (inputIndex >= value.length) {
				break;
			}

			const maskCharacter = this.#mask.charAt(maskIndex);
			const inputCharacter = value.charAt(inputIndex);
			const masks = {
				'0': /\d/,
				'X': /[A-Z]/,
				'x': /[a-z]/,
			};

			if (maskCharacter === inputCharacter) {
				output += maskCharacter;
				inputIndex += 1;
				continue;
			}

			if (!Object.hasOwn(masks, maskCharacter)) {
				output += maskCharacter;
				continue;
			}

			if (masks[maskCharacter].test(inputCharacter)) {
				output += inputCharacter;
			}

			inputIndex += 1;
		}

		field.value = output;
		return this.refresh();
	}
}