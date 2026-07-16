import { BaseComponent } from './base-component.js';

/**
 * Writes chip label content with an optional Font Awesome icon.
 */
function setChipContent(button, chip) {
	const icon = typeof chip?.icon === 'string' ? chip.icon.trim() : '';
	button.replaceChildren();

	if (icon) {
		const iconElement = document.createElement('i');
		if (icon.includes(' ')) {
			iconElement.classList.add(...icon.split(/\s+/));
		} else {
			iconElement.classList.add('fa-solid', `fa-${icon}`);
		}
		iconElement.setAttribute('aria-hidden', 'true');
		button.appendChild(iconElement);
	}

	const label = document.createElement('span');
	label.textContent = chip.label;
	button.appendChild(label);
}

export class QuickChips extends BaseComponent {
    #chips = [];
    #chipByButton = new Map();

	/**
	 * Creates a wrapper around the quick-filter chip container.
	 */
	constructor({ container }) {
		super(container);
	}

	/**
	 * Renders the current quick-chip definitions into buttons.
	 */
    render(chips = []) {
        if (!this.isReady()) {
            return this;
        }

        this.#chips = Array.isArray(chips)
            ? chips.filter(chip => chip && typeof chip.id !== 'undefined' && typeof chip.label === 'string')
            : [];

        this.#chipByButton.clear();
        const fragment = document.createDocumentFragment();
        this.#chips.forEach((chip) => {
            const button = document.createElement('button');
            button.className = 'chip';
            button.type = 'button';
            button.dataset.chipId = String(chip.id);
            this.#chipByButton.set(button, chip);
            setChipContent(button, chip);
            fragment.appendChild(button);
        });

		this.get().replaceChildren(fragment);
		return this;
	}

	/**
	 * Binds the selection handler used when a chip is clicked.
	 */
	bindSelect(onSelect) {
		if (!this.isReady() || typeof onSelect !== 'function') {
			return this;
		}

		this.destroy();
        this.on(this.get(), 'click', (event) => {
            const button = event.target.closest('[data-chip-id]');
            if (!button || !this.get().contains(button)) {
                return;
            }

            const chip = this.#chipByButton.get(button);
			if (!chip || typeof chip.buildFilters !== 'function') {
				return;
			}

			const filters = chip.buildFilters();
			if (!filters || typeof filters !== 'object') {
				return;
			}

			onSelect(filters, chip, this);
		});

		return this;
	}

	/**
	 * Returns the currently rendered chip definitions.
	 */
	getChips() {
		return [...this.#chips];
	}
}
