function escapeHtml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');
}

export class QuickChips {
	constructor({ container }) {
		this.container = container;
		this.chips = [];
	}

	isReady() {
		return Boolean(this.container);
	}

	render(chips = []) {
		if (!this.isReady()) {
			return;
		}

		this.chips = Array.isArray(chips) ? chips : [];
		this.container.innerHTML = this.chips
			.map((chip) => `
				<button class="chip" type="button" data-chip-id="${escapeHtml(chip.id)}">${escapeHtml(chip.label)}</button>
			`)
			.join('');
	}

	bindSelect(onSelect) {
		if (!this.isReady() || typeof onSelect !== 'function') {
			return;
		}

		this.container.addEventListener('click', (event) => {
			const button = event.target.closest('[data-chip-id]');
			if (!button) {
				return;
			}

			const chip = this.chips.find((item) => item.id === button.dataset.chipId);
			if (!chip || typeof chip.buildFilters !== 'function') {
				return;
			}

			onSelect(chip.buildFilters());
		});
	}
}
