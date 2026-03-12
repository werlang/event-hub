import { BaseComponent } from './base-component.js';

/**
 * Reports whether a value is a string.
 */
function isString(value) {
	return typeof value === 'string';
}

/**
 * Reports whether a field is checkbox-like or radio-like.
 */
function isCheckable(field) {
	return field?.tagName === 'INPUT' && (field.type === 'checkbox' || field.type === 'radio');
}

/**
 * Reports whether a field supports free-text masking.
 */
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

/**
 * Normalizes common truthy values into a boolean.
 */
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

	/**
	 * Creates a wrapper around a form control element.
	 */
	constructor(element) {
		super(element || document.createElement('input'));
		this.refresh();
	}

	/**
	 * Returns the normalized current value for the wrapped field.
	 */
	get value() {
		return this.getValue();
	}

	/**
	 * Reads the wrapped field value using control-type specific behavior.
	 */
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

	/**
	 * Writes a normalized value into the wrapped field.
	 */
	setValue(value) {
		if (!this.isReady()) {
			return this;
		}

		const field = this.get();
		if (isCheckable(field) && field.type === 'checkbox') {
			field.checked = Array.isArray(value)
				? value.includes(field.value)
				: normalizeBoolean(value);
			return this.refresh();
		}

		if (isCheckable(field) && field.type === 'radio') {
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

	/**
	 * Clears the wrapped field value.
	 */
	clear() {
		if (!this.isReady()) {
			return this;
		}

		const field = this.get();
		if (isCheckable(field)) {
			field.checked = false;
			return this.refresh();
		}

		field.value = '';
		return this.refresh();
	}

	/**
	 * Refreshes filled, disabled, and cosmetic field state.
	 */
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

	/**
	 * Marks the wrapped field as invalid.
	 */
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

	/**
	 * Clears any previous validation state from the wrapped field.
	 */
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

	/**
	 * Binds a keypress listener to the wrapped field.
	 */
	keyPress(callback) {
		return this.#bind('keypress', callback);
	}

	/**
	 * Binds a keyup listener to the wrapped field.
	 */
	keyUp(callback) {
		return this.#bind('keyup', callback);
	}

	/**
	 * Binds an input listener to the wrapped field.
	 */
	input(callback) {
		return this.#bind('input', callback);
	}

	/**
	 * Binds a change listener to the wrapped field.
	 */
	change(callback) {
		return this.#bind('change', callback);
	}

	/**
	 * Focuses the wrapped field.
	 */
	focus(options) {
		this.get()?.focus(options);
		return this;
	}

	/**
	 * Disables the wrapped field.
	 */
	disable() {
		if (this.isReady()) {
			this.get().disabled = true;
		}

		return this.refresh();
	}

	/**
	 * Enables the wrapped field.
	 */
	enable() {
		if (this.isReady()) {
			this.get().disabled = false;
		}

		return this.refresh();
	}

	/**
	 * Attaches and applies a simple character-mask definition.
	 */
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

	/**
	 * Binds a DOM event and refreshes the wrapper before invoking the callback.
	 */
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

	/**
	 * Applies the configured character mask to the current field value.
	 */
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