import { serializeEventDate } from '../helpers/date-serialize.js';
import { Form } from './form.js';

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

	constructor(form) {
		super(form);
		this.#timeToggle = this.getField('event-has-time') || null;
		this.#timeInput = this.getField('event-time') || null;
	}

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

	setEnabled(enabled) {
		super.setEnabled(enabled);

		if (enabled) {
			this.syncTimeState();
		}

		return this;
	}

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

	reset() {
		super.reset();
		this.syncTimeState();
		return this;
	}
}
