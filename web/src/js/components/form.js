import { BaseComponent } from './base-component.js';
import { Button } from './button.js';
import { Input } from './input.js';

const FORM_FIELD_SELECTOR = 'input, select, textarea, button';
const DEFAULT_DISABLED_STATE_KEY = 'default';

/**
 * Appends a new value to a field bucket while preserving multi-value fields.
 */
function createBucketValue(currentValue, nextValue) {
	if (currentValue === undefined) {
		return nextValue;
	}

	return Array.isArray(currentValue) ? [...currentValue, nextValue] : [currentValue, nextValue];
}

/**
 * Resolves a stable key for a form control.
 */
function readControlKey(element, index, prefix) {
	return element.id || element.name || `${prefix}-${index}`;
}

/**
 * Reports whether a control key should participate in autosave.
 */
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

/**
 * Reads and parses autosaved JSON data from localStorage.
 */
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

/**
 * Stores autosaved JSON data in localStorage.
 */
function writeStoredJson(key, value) {
	if (!key) {
		return;
	}

	localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Normalizes the state key used to track concurrent disabled reasons.
 */
function normalizeDisabledStateKey(stateKey) {
	if (typeof stateKey !== 'string' || !stateKey.trim()) {
		return DEFAULT_DISABLED_STATE_KEY;
	}

	return stateKey.trim();
}

export class Form extends BaseComponent {
	#disabledStates = new Set();
	#fieldDisabledStates = new Map();
	#buttons = new Map();
	#inputs = new Map();
	#selects = new Map();
	#autoSave;
	#submitHandler = null;

	/**
	 * Creates a form wrapper with control discovery and optional autosave behavior.
	 */
	constructor(element, { autoSave } = {}) {
		super(element);
		this.#autoSave = this.#normalizeAutoSave(autoSave);

		if (!super.isReady()) {
			return;
		}

		this.#collectButtons();
		this.#collectInputs();
		this.#collectSelects();
		this.#snapshotFieldStates();
		this.#bindEnterKeyBehavior();
		this.loadAutoSave();
		this.#bindAutoSave();
	}

	/**
	 * Returns the normalized autosave configuration for this form.
	 */
	get autoSave() {
		return this.#autoSave;
	}

	/**
	 * Returns one button or all discovered button controls.
	 */
	getButton(id) {
		if (!id) {
			return Array.from(this.#buttons.values());
		}

		return this.#buttons.get(id) || false;
	}

	/**
	 * Returns the first submit button registered for the form.
	 */
	getSubmitButton() {
		return this.getButton().find(button => button.get().type === 'submit') || null;
	}

	/**
	 * Returns one input control or all discovered inputs.
	 */
	getInput(id) {
		if (!id) {
			return Array.from(this.#inputs.values());
		}

		return this.#inputs.get(id) || false;
	}

	/**
	 * Returns one select control or all discovered selects.
	 */
	getSelect(id) {
		if (!id) {
			return Array.from(this.#selects.values());
		}

		return this.#selects.get(id) || false;
	}

	/**
	 * Returns a control by id across both inputs and selects.
	 */
	getField(id) {
		return this.getInput(id) || this.getSelect(id) || false;
	}

	/**
	 * Returns the form element or queries a descendant selector.
	 */
	get(selector) {
		if (!selector) {
			return super.get();
		}

		return super.get()?.querySelector(selector) || null;
	}

	/**
	 * Reports whether any disabled state is currently active.
	 */
	isDisabled() {
		return this.#disabledStates.size > 0;
	}

	/**
	 * Applies or removes a disabled state reason for the form.
	 */
	setEnabled(enabled, { stateKey = DEFAULT_DISABLED_STATE_KEY } = {}) {
		if (!this.isReady()) {
			return this;
		}

		const normalizedStateKey = normalizeDisabledStateKey(stateKey);
		const wasDisabled = this.isDisabled();

		if (Boolean(enabled)) {
			this.#disabledStates.delete(normalizedStateKey);
		} else {
			this.#disabledStates.add(normalizedStateKey);
		}

		const isDisabled = this.isDisabled();
		if (!wasDisabled && isDisabled) {
			this.#rememberAndDisableFields();
		} else if (wasDisabled && !isDisabled) {
			this.#restoreFields();
		}

		this.#syncDisabledState(isDisabled);
		this.#refreshControls();
		return this;
	}

	/**
	 * Removes a disabled state reason from the form.
	 */
	enable(options) {
		return this.setEnabled(true, options);
	}

	/**
	 * Adds a disabled state reason to the form.
	 */
	disable(options) {
		return this.setEnabled(false, options);
	}

	/**
	 * Runs field validation rules and returns the aggregate result.
	 */
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

	/**
	 * Reads the form data into a plain object.
	 */
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

	/**
	 * Binds the form submit lifecycle to an async callback.
	 */
	submit(callback, { reset = false, manageDisabledState = true, stateKey = 'submit' } = {}) {
		if (!this.isReady() || typeof callback !== 'function') {
			return this;
		}

		if (this.#submitHandler) {
			super.get().removeEventListener('submit', this.#submitHandler);
		}

		this.#submitHandler = async (event) => {
			event.preventDefault();

			const submitButton = this.getSubmitButton();
			const shouldManageDisabledState = Boolean(manageDisabledState);
			const normalizedStateKey = normalizeDisabledStateKey(stateKey);
			try {
				if (shouldManageDisabledState) {
					this.disable({ stateKey: normalizedStateKey });
				}

				submitButton?.disable({ showBusy: true });
				await callback(this.readData(), this, event);

				if (reset) {
					this.reset();
				}

				this.clearAutoSave();
			} finally {
				if (shouldManageDisabledState) {
					this.enable({ stateKey: normalizedStateKey });
				}

				submitButton?.enable();
				if (this.isDisabled()) {
					submitButton?.disable();
				}
			}
		};

		super.get().addEventListener('submit', this.#submitHandler);
		return this;
	}

	/**
	 * Resets the form element and refreshes every tracked control.
	 */
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

	/**
	 * Loads autosaved values from localStorage into the current controls.
	 */
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

	/**
	 * Persists a partial set of field values to localStorage.
	 */
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

	/**
	 * Clears any autosaved state for the form.
	 */
	clearAutoSave() {
		if (this.#autoSave.enabled && this.#autoSave.key) {
			localStorage.removeItem(this.#autoSave.key);
		}

		return this;
	}

	/**
	 * Normalizes the autosave configuration into a predictable object.
	 */
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

	/**
	 * Discovers button controls within the wrapped element.
	 */
	#collectButtons() {
		Array.from(super.get().querySelectorAll('button')).forEach((element, index) => {
			this.#buttons.set(readControlKey(element, index, 'button'), new Button({ element }));
		});
	}

	/**
	 * Returns the native form fields managed by this wrapper.
	 */
	#fields() {
		if (!this.isReady()) {
			return [];
		}

		return Array.from(super.get().querySelectorAll(FORM_FIELD_SELECTOR));
	}

	/**
	 * Discovers input and textarea controls within the wrapped element.
	 */
	#collectInputs() {
		Array.from(super.get().querySelectorAll('input, textarea')).forEach((element, index) => {
			const key = readControlKey(element, index, 'input');
			const instance = new Input(element);
			this.#inputs.set(key, createBucketValue(this.#inputs.get(key), instance));
		});
	}

	/**
	 * Discovers select controls within the wrapped element.
	 */
	#collectSelects() {
		Array.from(super.get().querySelectorAll('select')).forEach((element, index) => {
			const key = readControlKey(element, index, 'select');
			const instance = new Input(element);
			this.#selects.set(key, createBucketValue(this.#selects.get(key), instance));
		});
	}

	/**
	 * Enables Enter-key submission for non-form containers.
	 */
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

	/**
	 * Binds autosave listeners for every persistable field.
	 */
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

	/**
	 * Wraps a control or control group in a predictable array.
	 */
	#normalizeControls(control) {
		if (!control) {
			return [];
		}

		return Array.isArray(control) ? control : [control];
	}

	/**
	 * Refreshes every tracked field wrapper.
	 */
	#refreshControls() {
		this.#forEachControl(control => control.refresh());
	}

	/**
	 * Iterates over every tracked input wrapper.
	 */
	#forEachInput(callback) {
		Array.from(this.#inputs.values()).forEach((control) => {
			this.#normalizeControls(control).forEach(callback);
		});
	}

	/**
	 * Iterates over every tracked control wrapper.
	 */
	#forEachControl(callback) {
		[...this.#inputs.values(), ...this.#selects.values()].forEach((control) => {
			this.#normalizeControls(control).forEach(callback);
		});
	}

	/**
	 * Iterates over every tracked control entry keyed by its form identifier.
	 */
	#forEachEntry(callback) {
		for (const [key, value] of this.#inputs.entries()) {
			callback(key, value);
		}

		for (const [key, value] of this.#selects.entries()) {
			callback(key, value);
		}
	}

	/**
	 * Reads a normalized value for a control group.
	 */
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

	/**
	 * Applies an autosaved value to one control or control group.
	 */
	#applySavedValue(control, value) {
		this.#normalizeControls(control).forEach((instance) => {
			instance.setValue(value);
		});
	}

	/**
	 * Updates the disabled CSS and accessibility state for the form.
	 */
	#syncDisabledState(isDisabled) {
		super.get().classList.toggle('form--disabled', isDisabled);
		super.get().setAttribute('aria-disabled', isDisabled ? 'true' : 'false');
	}

	/**
	 * Snapshots the native disabled state for every managed field.
	 */
	#snapshotFieldStates() {
		this.#fieldDisabledStates = new Map();
		this.#fields().forEach((field) => {
			this.#fieldDisabledStates.set(field, field.disabled);
		});
	}

	/**
	 * Records and disables every managed field.
	 */
	#rememberAndDisableFields() {
		this.#snapshotFieldStates();
		this.#fields().forEach((field) => {
			field.disabled = true;
		});
	}

	/**
	 * Restores each managed field to its pre-disabled state.
	 */
	#restoreFields() {
		this.#fields().forEach((field) => {
			field.disabled = this.#fieldDisabledStates.get(field) ?? false;
		});

		this.#snapshotFieldStates();
	}
}