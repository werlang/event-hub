import { Form } from './form.js';

export class FilterForm extends Form {
	#fields;
	#applyHandler = null;

	constructor({ form, filterSearch, filterCategory, filterFrom, filterTo }) {
		super(form);
		this.#fields = {
			search: this.getField(filterSearch?.id || 'filter-search') || null,
			category: this.getField(filterCategory?.id || 'filter-category') || null,
			from: this.getField(filterFrom?.id || 'filter-from') || null,
			to: this.getField(filterTo?.id || 'filter-to') || null,
		};
	}

	isReady() {
		return super.isReady() && Object.values(this.#fields).every(Boolean);
	}

	readFilters() {
		return {
			search: this.#readField('search').trim(),
			category: this.#readField('category'),
			from: this.#readField('from'),
			to: this.#readField('to'),
		};
	}

	hydrate(filters = {}) {
		if (!this.isReady()) {
			return this;
		}

		const nextFilters = filters && typeof filters === 'object' ? filters : {};
		this.#setFieldValue('search', nextFilters.search ?? '');
		this.#setFieldValue('category', nextFilters.category ?? '');
		this.#setFieldValue('from', nextFilters.from ?? this.#readField('from'));
		this.#setFieldValue('to', nextFilters.to ?? this.#readField('to'));
		return this;
	}

	bindApply(onApply) {
		if (!super.isReady() || typeof onApply !== 'function') {
			return this;
		}

		if (this.#applyHandler) {
			super.get().removeEventListener('submit', this.#applyHandler);
		}

		this.#applyHandler = (event) => {
			event.preventDefault();
			onApply(this.readFilters(), this);
		};

		super.get().addEventListener('submit', this.#applyHandler);

		return this;
	}

	#getField(name) {
		return this.#fields[name] || null;
	}

	#readField(name) {
		return this.#getField(name)?.getValue() || '';
	}

	#setFieldValue(name, value) {
		const field = this.#getField(name);
		if (!field) {
			return;
		}

		field.setValue(typeof value === 'string' ? value : '');
	}
}
