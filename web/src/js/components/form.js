import { BaseComponent } from './base-component.js';
import { Button } from './button.js';
import { Input } from './input.js';
import { createFormState } from './form-state.js';

function createBucketValue(currentValue, nextValue) {
	if (currentValue === undefined) {
		return nextValue;
	}

	return Array.isArray(currentValue) ? [...currentValue, nextValue] : [currentValue, nextValue];
}

function readControlKey(element, index, prefix) {
	return element.id || element.name || `${prefix}-${index}`;
}

function isPersistableKey(autoSave, key) {
	if (!autoSave?.enabled || !key) {
		return false;
	}

	if (Array.isArray(autoSave.exclude) && autoSave.exclude.includes(key)) {
		return false;
	}

	if (Array.isArray(autoSave.include)) {
		return autoSave.include.includes(key);
	}

	return true;
}

function readStoredJson(key) {
	if (!key) {
		return null;
	}

	try {
		const rawValue = localStorage.getItem(key);
		if (!rawValue) {
			return null;
		}

		return JSON.parse(rawValue);
	} catch {
		return null;
	}
}

function writeStoredJson(key, value) {
	if (!key) {
		return;
	}

	localStorage.setItem(key, JSON.stringify(value));
}

export class Form extends BaseComponent {
	#formState;
	#buttons = new Map();
	#inputs = new Map();
	#selects = new Map();
	#autoSave;
	#submitHandler = null;

	constructor(element, { autoSave } = {}) {
		super(element);
		this.#formState = createFormState(element);
		this.#autoSave = this.#normalizeAutoSave(autoSave);

		if (!super.isReady()) {
			return;
		}

		this.#collectButtons();
		this.#collectInputs();
		this.#collectSelects();
		this.#bindEnterKeyBehavior();
		this.loadAutoSave();
		this.#bindAutoSave();
	}

	get autoSave() {
		return this.#autoSave;
	}

	getButton(id) {
		if (!id) {
			return Array.from(this.#buttons.values());
		}

		return this.#buttons.get(id) || false;
	}

	getInput(id) {
		if (!id) {
			return Array.from(this.#inputs.values());
		}

		return this.#inputs.get(id) || false;
	}

	getSelect(id) {
		if (!id) {
			return Array.from(this.#selects.values());
		}

		return this.#selects.get(id) || false;
	}

	getField(id) {
		return this.getInput(id) || this.getSelect(id) || false;
	}

	get(selector) {
		if (!selector) {
			return super.get();
		}

		return super.get()?.querySelector(selector) || null;
	}

	setEnabled(enabled) {
		this.#formState.setEnabled(enabled);
		return this;
	}

	validate(validationArray = [], silent = false) {
		const response = {
			success: { total: 0, list: [] },
			fail: { total: 0, list: [] },
		};

		for (const validation of validationArray) {
			const { id, rule, message } = validation || {};
			if (!id || typeof rule !== 'function') {
				continue;
			}

			const controls = this.#normalizeControls(this.getField(id));
			if (!controls.length) {
				continue;
			}

			const value = this.#readGroupValue(controls);
			const isValid = Boolean(rule(value, this));

			if (isValid) {
				controls.forEach(control => control.clearError());
				response.success.total += 1;
				response.success.list.push(id);
				continue;
			}

			if (!silent) {
				controls.forEach(control => control.setError(message, { report: false }));
				controls[0]?.setError(message, { report: true });
			}

			response.fail.total += 1;
			response.fail.list.push(id);
			break;
		}

		return response;
	}

	readData() {
		if (!this.isReady()) {
			return {};
		}

		const element = super.get();
		const data = {};

		if (element instanceof HTMLFormElement) {
			for (const [key, value] of new FormData(element).entries()) {
				data[key] = createBucketValue(data[key], value);
			}
		}

		return data;
	}

	submit(callback, { reset = false } = {}) {
		if (!this.isReady() || typeof callback !== 'function') {
			return this;
		}

		if (this.#submitHandler) {
			super.get().removeEventListener('submit', this.#submitHandler);
		}

		this.#submitHandler = async (event) => {
			event.preventDefault();

			const submitButton = this.#findSubmitButton();
			try {
				submitButton?.disable({ showBusy: true });
				await callback(this.readData(), this, event);

				if (reset) {
					this.reset();
				}

				this.clearAutoSave();
			} finally {
				submitButton?.enable();
			}
		};

		super.get().addEventListener('submit', this.#submitHandler);
		return this;
	}

	reset() {
		if (!this.isReady()) {
			return this;
		}

		super.get().reset();
		this.#forEachControl(control => {
			control.clearError();
			control.refresh();
		});
		return this;
	}

	loadAutoSave() {
		if (!this.#autoSave.enabled || !this.#autoSave.key) {
			return false;
		}

		const savedData = readStoredJson(this.#autoSave.key);
		if (!savedData || typeof savedData !== 'object') {
			return false;
		}

		Object.entries(savedData).forEach(([key, value]) => {
			const control = this.getField(key);
			if (!control) {
				return;
			}

			this.#applySavedValue(control, value);
		});

		return savedData;
	}

	save(fields) {
		if (!this.#autoSave.enabled || !this.#autoSave.key || !fields || typeof fields !== 'object') {
			return this;
		}

		const storedData = readStoredJson(this.#autoSave.key) || {};
		Object.entries(fields).forEach(([key, value]) => {
			storedData[key] = value;
		});

		writeStoredJson(this.#autoSave.key, storedData);
		return this;
	}

	clearAutoSave() {
		if (this.#autoSave.enabled && this.#autoSave.key) {
			localStorage.removeItem(this.#autoSave.key);
		}

		return this;
	}

	#normalizeAutoSave(autoSave) {
		if (!autoSave || typeof autoSave !== 'object') {
			return { enabled: false };
		}

		return {
			enabled: Boolean(autoSave.enabled && typeof autoSave.key === 'string' && autoSave.key.trim()),
			key: typeof autoSave.key === 'string' ? autoSave.key.trim() : '',
			exclude: Array.isArray(autoSave.exclude) ? autoSave.exclude : null,
			include: Array.isArray(autoSave.include) ? autoSave.include : null,
		};
	}

	#collectButtons() {
		Array.from(super.get().querySelectorAll('button')).forEach((element, index) => {
			this.#buttons.set(readControlKey(element, index, 'button'), new Button({ element }));
		});
	}

	#collectInputs() {
		Array.from(super.get().querySelectorAll('input, textarea')).forEach((element, index) => {
			const key = readControlKey(element, index, 'input');
			const instance = new Input(element);
			this.#inputs.set(key, createBucketValue(this.#inputs.get(key), instance));
		});
	}

	#collectSelects() {
		Array.from(super.get().querySelectorAll('select')).forEach((element, index) => {
			const key = readControlKey(element, index, 'select');
			const instance = new Input(element);
			this.#selects.set(key, createBucketValue(this.#selects.get(key), instance));
		});
	}

	#bindEnterKeyBehavior() {
		if (super.get().tagName === 'FORM') {
			return;
		}

		this.#forEachInput((input) => {
			const field = input.get();
			if (field.tagName === 'TEXTAREA' || field.type === 'checkbox' || field.type === 'radio') {
				return;
			}

			input.keyPress((event) => {
				if (event.key !== 'Enter') {
					return;
				}

				const defaultButton = this.getButton().find(button => button.get().classList.contains('default'));
				if (!defaultButton || defaultButton.get().type === 'submit') {
					return;
				}

				event.preventDefault();
				defaultButton.click();
			});
		});
	}

	#bindAutoSave() {
		this.#forEachEntry((key, control) => {
			if (!isPersistableKey(this.#autoSave, key)) {
				return;
			}

			const persist = () => {
				this.save({ [key]: this.#readGroupValue(this.#normalizeControls(control)) });
			};

			this.#normalizeControls(control).forEach((instance) => {
				instance.input(persist);
				instance.change(persist);
			});
		});
	}

	#normalizeControls(control) {
		if (!control) {
			return [];
		}

		return Array.isArray(control) ? control : [control];
	}

	#forEachInput(callback) {
		Array.from(this.#inputs.values()).forEach((control) => {
			this.#normalizeControls(control).forEach(callback);
		});
	}

	#forEachControl(callback) {
		[...this.#inputs.values(), ...this.#selects.values()].forEach((control) => {
			this.#normalizeControls(control).forEach(callback);
		});
	}

	#forEachEntry(callback) {
		for (const [key, value] of this.#inputs.entries()) {
			callback(key, value);
		}

		for (const [key, value] of this.#selects.entries()) {
			callback(key, value);
		}
	}

	#readGroupValue(controls) {
		if (!controls.length) {
			return '';
		}

		if (controls.length === 1) {
			return controls[0].getValue();
		}

		const firstField = controls[0].get();
		if (firstField.tagName === 'INPUT' && firstField.type === 'radio') {
			return controls.map(control => control.getValue()).find(Boolean) || '';
		}

		if (firstField.tagName === 'INPUT' && firstField.type === 'checkbox') {
			return controls
				.filter(control => control.get().checked)
				.map(control => control.get().value);
		}

		return controls.map(control => control.getValue());
	}

	#applySavedValue(control, value) {
		this.#normalizeControls(control).forEach((instance) => {
			instance.setValue(value);
		});
	}

	#findSubmitButton() {
		return this.getButton().find(button => button.get().type === 'submit') || null;
	}
}