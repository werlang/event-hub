import { BaseComponent } from './base-component.js';

/**
 * Returns one non-empty button label with a safe fallback.
 */
function readPaginationLabel(label, fallback = 'Pagina') {
    const normalizedLabel = typeof label === 'string' ? label.trim() : '';
    return normalizedLabel || fallback;
}

/**
 * Builds the compact page sequence rendered by the pagination controls.
 */
function readPageSequence(currentPage, totalPages) {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const visiblePages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
    const sortedPages = Array.from(visiblePages)
        .filter((page) => Number.isInteger(page) && page >= 1 && page <= totalPages)
        .sort((left, right) => left - right);

    return sortedPages.reduce((sequence, page) => {
        const previousPage = sequence.at(-1);

        if (typeof previousPage === 'number' && page - previousPage === 2) {
            sequence.push(previousPage + 1);
        } else if (typeof previousPage === 'number' && page - previousPage > 2) {
            sequence.push('ellipsis');
        }

        sequence.push(page);
        return sequence;
    }, []);
}

/**
 * Creates one interactive page button.
 */
function createPaginationButton({ label, page, icon, current = false, disabled = false, navigation = false } = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    const buttonClasses = ['button', 'button--ghost', 'pagination__button'];

    if (current) {
        buttonClasses.push('pagination__button--current');
    }

    if (navigation) {
        buttonClasses.push('pagination__button--nav');
    }

    button.className = buttonClasses.join(' ');
    button.disabled = Boolean(disabled);

    const resolvedLabel = readPaginationLabel(label);
    if (current) {
        button.setAttribute('aria-current', 'page');
    }

    button.setAttribute('aria-label', navigation ? resolvedLabel : `Ir para a pagina ${resolvedLabel}`);

    if (!disabled && Number.isInteger(page)) {
        button.dataset.page = String(page);
    }

    if (typeof icon === 'string' && icon.trim()) {
        const iconElement = document.createElement('i');
        iconElement.classList.add('fa-solid', `fa-${icon.trim()}`);
        iconElement.setAttribute('aria-hidden', 'true');
        button.appendChild(iconElement);
    }

    const labelElement = document.createElement('span');
    labelElement.textContent = resolvedLabel;
    button.appendChild(labelElement);
    return button;
}

/**
 * Creates the non-interactive ellipsis marker used inside the pager.
 */
function createPaginationGap() {
    const gap = document.createElement('span');
    gap.className = 'pagination__gap';
    gap.setAttribute('aria-hidden', 'true');
    gap.textContent = '...';
    return gap;
}

export class Pagination extends BaseComponent {
    #summary;
    #controls;
    #pageSize;
    #onPageChange = null;

    /**
     * Creates one reusable pagination controller around a container, summary, and controls region.
     */
    constructor({ container, summary, controls, pageSize = 10 } = {}) {
        super(container || null);
        this.#summary = summary || null;
        this.#controls = controls || null;
        this.#pageSize = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 10;

        this.on(this.#controls, 'click', (domEvent) => {
            this.#handleControlClick(domEvent);
        });
    }

    /**
     * Reports whether the pagination controller has every required DOM element.
     */
    isReady() {
        return Boolean(super.isReady() && this.#summary && this.#controls);
    }

    /**
     * Stores the callback fired when the user selects another page.
     */
    onPageChange(callback) {
        this.#onPageChange = typeof callback === 'function' ? callback : null;
        return this;
    }

    /**
     * Returns the number of pages required for the provided collection.
     */
    readPageCount(items = []) {
        const totalItems = Array.isArray(items) ? items.length : 0;
        if (totalItems === 0) {
            return 0;
        }

        return Math.ceil(totalItems / this.#pageSize);
    }

    /**
     * Clamps one arbitrary page number into the available pagination range.
     */
    clampPage(page, itemsOrTotalPages = 0) {
        const totalPages = Array.isArray(itemsOrTotalPages)
            ? this.readPageCount(itemsOrTotalPages)
            : Number(itemsOrTotalPages);
        const normalizedPage = Number.parseInt(page, 10);

        if (!Number.isInteger(totalPages) || totalPages < 1) {
            return 1;
        }

        if (!Number.isInteger(normalizedPage) || normalizedPage < 1) {
            return 1;
        }

        return Math.min(normalizedPage, totalPages);
    }

    /**
     * Returns the current page slice for the provided item collection.
     */
    readPageItems(items = [], page = 1) {
        const normalizedItems = Array.isArray(items) ? items : [];
        const totalPages = this.readPageCount(normalizedItems);
        if (totalPages === 0) {
            return [];
        }

        const currentPage = this.clampPage(page, totalPages);
        const startIndex = (currentPage - 1) * this.#pageSize;
        return normalizedItems.slice(startIndex, startIndex + this.#pageSize);
    }

    /**
     * Renders the summary and page controls for the provided collection.
     */
    render({ items = [], currentPage = 1 } = {}) {
        if (!this.isReady()) {
            return this;
        }

        const totalItems = Array.isArray(items) ? items.length : 0;
        const totalPages = this.readPageCount(items);

        if (totalPages <= 1) {
            this.setHidden(true);
            this.#controls.replaceChildren();
            this.#summary.textContent = totalItems === 0
                ? 'Mostrando 0 de 0 eventos.'
                : `Mostrando ${totalItems} de ${totalItems} eventos.`;
            return this;
        }

        const safePage = this.clampPage(currentPage, totalPages);
        const startIndex = ((safePage - 1) * this.#pageSize) + 1;
        const endIndex = Math.min(safePage * this.#pageSize, totalItems);

        this.setHidden(false);
        this.#summary.textContent = `Mostrando ${startIndex} a ${endIndex} de ${totalItems} eventos.`;

        const controls = document.createDocumentFragment();
        controls.appendChild(createPaginationButton({
            label: 'Anterior',
            page: safePage - 1,
            icon: 'arrow-left',
            disabled: safePage === 1,
            navigation: true,
        }));

        readPageSequence(safePage, totalPages).forEach((item) => {
            if (item === 'ellipsis') {
                controls.appendChild(createPaginationGap());
                return;
            }

            controls.appendChild(createPaginationButton({
                label: String(item),
                page: item,
                current: item === safePage,
            }));
        });

        controls.appendChild(createPaginationButton({
            label: 'Proxima',
            page: safePage + 1,
            icon: 'arrow-right',
            disabled: safePage === totalPages,
            navigation: true,
        }));

        this.#controls.replaceChildren(controls);
        return this;
    }

    /**
     * Handles clicks on the rendered page controls.
     */
    #handleControlClick(domEvent) {
        const button = domEvent.target instanceof Element
            ? domEvent.target.closest('button[data-page]')
            : null;

        if (!button || !this.#controls?.contains(button)) {
            return;
        }

        const page = Number.parseInt(button.dataset.page || '', 10);
        if (!Number.isInteger(page)) {
            return;
        }

        this.#onPageChange?.({ page });
    }
}