const FORM_FIELD_SELECTOR = 'input, select, textarea, button';
const formStateRegistry = new WeakMap();

export class FormState {
	#form;
	#fieldDisabledStates = new Map();
	#managedDisabled = false;

	constructor(form) {
		this.#form = form ?? null;
		this.#snapshotFieldStates();
	}

	get() {
		return this.#form;
	}

	isReady() {
		return Boolean(this.#form);
	}

	setEnabled(enabled) {
		if (!this.isReady()) {
			return this;
		}

		const isEnabled = Boolean(enabled);
		this.#form.classList.toggle('form--disabled', !isEnabled);
		this.#form.setAttribute('aria-disabled', isEnabled ? 'false' : 'true');

		if (isEnabled) {
			if (!this.#managedDisabled) {
				return this;
			}

			this.#restoreFields();
			this.#managedDisabled = false;
			return this;
		}

		if (this.#managedDisabled) {
			return this;
		}

		this.#rememberAndDisableFields();
		this.#managedDisabled = true;
		return this;
	}

	enable() {
		return this.setEnabled(true);
	}

	disable() {
		return this.setEnabled(false);
	}

	#fields() {
		if (!this.#form) {
			return [];
		}

		return Array.from(this.#form.querySelectorAll(FORM_FIELD_SELECTOR));
	}

	#snapshotFieldStates() {
		this.#fieldDisabledStates = new Map();
		this.#fields().forEach((field) => {
			this.#fieldDisabledStates.set(field, field.disabled);
		});
	}

	#rememberAndDisableFields() {
		this.#snapshotFieldStates();
		this.#fields().forEach((field) => {
			field.disabled = true;
		});
	}

	#restoreFields() {
		this.#fields().forEach((field) => {
			field.disabled = this.#fieldDisabledStates.get(field) ?? false;
		});

		this.#snapshotFieldStates();
	}
}

export function createFormState(form) {
	if (!form) {
		return new FormState(null);
	}

	let formState = formStateRegistry.get(form);
	if (!formState) {
		formState = new FormState(form);
		formStateRegistry.set(form, formState);
	}

	return formState;
}

export function setFormEnabled(form, enabled) {
	return createFormState(form).setEnabled(enabled);
}
