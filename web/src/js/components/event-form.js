import { serializeEventDate } from '../helpers/date-serialize.js';
import { Form } from './form.js';

/**
 * Normalizes optional form text values to trimmed strings.
 */
function toTrimmedString(value) {
	if (typeof value !== 'string') {
		return '';
	}

	return value.trim();
}

export class EventForm extends Form {
	#timeToggle;
	#timeInput;
	#isBound = false;

	/**
	 * Creates a publish-form wrapper with date and time controls.
	 */
	constructor(form) {
		super(form);
		this.#timeToggle = this.getField('event-has-time') || null;
		this.#timeInput = this.getField('event-time') || null;
	}

	/**
	 * Binds the time toggle behavior for the publish form.
	 */
	bind() {
		if (!this.#timeToggle || !this.#timeInput) {
			return this;
		}

		if (!this.#isBound) {
			this.#timeToggle.change(() => {
				this.syncTimeState();
			});
			this.#isBound = true;
		}

		this.syncTimeState();
		return this;
	}

	/**
	 * Updates the form enabled state and syncs the time controls.
	 */
	setEnabled(enabled, options) {
		super.setEnabled(enabled, options);

		if (!this.isDisabled()) {
			this.syncTimeState();
		}

		return this;
	}

	/**
	 * Synchronizes the time input with the state of the time toggle.
	 */
	syncTimeState() {
		if (!this.#timeToggle || !this.#timeInput) {
			return this;
		}

		const isEnabled = this.#timeToggle.get().checked;

		if (!isEnabled) {
			this.#timeInput.disable().clear();
			return this;
		}

		this.#timeInput.enable();

		return this;
	}

	/**
	 * Converts the current form state into an event API payload.
	 */
	toPayload() {
		if (!this.isReady()) {
			return {
				ok: false,
				message: 'Formulário indisponível no momento.',
			};
		}

		const data = this.readData();
		const title = toTrimmedString(data.title);
		const description = toTrimmedString(data.description);
		const location = toTrimmedString(data.location);
		const includeTime = this.#timeToggle?.get().checked === true;
		const date = serializeEventDate({
			date: data.date,
			time: data.time,
			includeTime,
		});

		if (!title) {
			return {
				ok: false,
				message: 'Informe um título para publicar.',
			};
		}

		if (!description) {
			return {
				ok: false,
				message: 'Informe uma descrição para publicar.',
			};
		}

		if (!date) {
			return {
				ok: false,
				message: includeTime
					? 'Selecione uma data e horário válidos para publicar.'
					: 'Selecione uma data válida para publicar.',
			};
		}

		return {
			ok: true,
			payload: {
				title,
				description,
				category: typeof data.category === 'string' && data.category ? data.category : 'Geral',
				location,
				date,
			},
		};
	}

	/**
	 * Resets the form and reapplies the time toggle state.
	 */
	reset() {
		super.reset();
		this.syncTimeState();
		return this;
	}
}
