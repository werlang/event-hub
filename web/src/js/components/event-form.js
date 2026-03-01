import { serializeEventDate } from '../helpers/date-serialize.js';

function toTrimmedString(value) {
	if (typeof value !== 'string') {
		return '';
	}

	return value.trim();
}

export class EventForm {
	constructor(form) {
		this.form = form;
		this.timeToggle = this.form?.querySelector('#event-has-time');
		this.timeInput = this.form?.querySelector('#event-time');
	}

	bind() {
		if (!this.timeToggle || !this.timeInput) {
			return;
		}

		this.timeToggle.addEventListener('change', () => {
			this.syncTimeState();
		});

		this.syncTimeState();
	}

	syncTimeState() {
		if (!this.timeToggle || !this.timeInput) {
			return;
		}

		const isEnabled = this.timeToggle.checked;
		this.timeInput.disabled = !isEnabled;

		if (!isEnabled) {
			this.timeInput.value = '';
		}
	}

	toPayload() {
		const data = Object.fromEntries(new FormData(this.form).entries());
		const includeTime = this.timeToggle?.checked === true;
		const date = serializeEventDate({
			date: data.date,
			time: data.time,
			includeTime,
		});

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
				title: toTrimmedString(data.title),
				description: toTrimmedString(data.description),
				category: data.category,
				location: toTrimmedString(data.location),
				date,
			},
		};
	}

	reset() {
		if (!this.form) {
			return;
		}

		this.form.reset();
		this.syncTimeState();
	}
}
