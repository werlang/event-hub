export class FilterForm {
	constructor({ form, filterSearch, filterCategory, filterFrom, filterTo }) {
		this.form = form;
		this.filterSearch = filterSearch;
		this.filterCategory = filterCategory;
		this.filterFrom = filterFrom;
		this.filterTo = filterTo;
	}

	isReady() {
		return Boolean(
			this.form
			&& this.filterSearch
			&& this.filterCategory
			&& this.filterFrom
			&& this.filterTo,
		);
	}

	readFilters() {
		return {
			search: this.filterSearch?.value || '',
			category: this.filterCategory?.value || '',
			from: this.filterFrom?.value || '',
			to: this.filterTo?.value || '',
		};
	}

	hydrate(filters = {}) {
		if (!this.isReady()) {
			return;
		}

		this.filterSearch.value = filters.search || '';
		this.filterCategory.value = filters.category || '';
		this.filterFrom.value = filters.from || this.filterFrom.value || '';
		this.filterTo.value = filters.to || this.filterTo.value || '';
	}

	bindApply(onApply) {
		if (!this.form || typeof onApply !== 'function') {
			return;
		}

		this.form.addEventListener('submit', (event) => {
			event.preventDefault();
			onApply(this.readFilters());
		});
	}
}
