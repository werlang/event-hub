import { BaseComponent } from './base-component.js';
import { Button } from './button.js';
import { formatDateTimePtBr } from '../helpers/date-format.js';
import { isPastEvent, sortEventsByDateDescending } from '../helpers/event-sort.js';

/**
 * Normalizes optional text content while preserving a fallback label.
 */
function readText(value, fallback) {
	if (typeof value !== 'string') {
		return fallback;
	}

	const normalizedValue = value.trim();
	return normalizedValue || fallback;
}

/**
 * Returns the member-facing moderation copy for an event status.
 */
export function describeMemberEventStatus(status) {
	const normalizedStatus = typeof status === 'string'
		? status.trim().toLowerCase()
		: 'pending';

	switch (normalizedStatus) {
	case 'published':
		return {
			value: 'published',
			label: 'Publicado',
			description: 'Este evento já aparece na agenda pública.',
		};
	case 'rejected':
		return {
			value: 'rejected',
			label: 'Rejeitado',
			description: 'Revise os dados e reenvie o evento para nova avaliação.',
		};
	default:
		return {
			value: 'pending',
			label: 'Em revisão',
			description: 'Seu evento aguarda aprovação e ainda não está público.',
		};
	}
}

/**
 * Reports whether the event still supports member-side edit and delete actions.
 */
export function canManageMemberEvent(event) {
	return describeMemberEventStatus(event?.status).value !== 'published';
}

/**
 * Creates one compact metadata pill for the member event card.
 */
function createMetaItem(text) {
	const item = document.createElement('span');
	item.textContent = text;
	return item;
}

/**
 * Creates a dashboard action button with the shared button wrapper.
 */
function createActionButton({ text, className, loadingLabel, manageBusy = false, onClick }) {
	const element = document.createElement('button');
	element.type = 'button';
	element.className = ['button', className].filter(Boolean).join(' ');

	const button = new Button({
		element,
		text,
		loadingLabel,
	});

	button.click(async (event) => {
		if (typeof onClick === 'function') {
			await onClick(event, button);
		}
	}, { manageBusy });

	return element;
}

export class MemberEventList extends BaseComponent {
	#emptyState;
	#defaultEmptyMessage;
	#onDelete = null;
	#onEdit = null;

	/**
	 * Creates a dashboard-specific event list wrapper.
	 */
	constructor({ list, emptyState } = {}) {
		super(list || null);
		this.#emptyState = emptyState || null;
		this.#defaultEmptyMessage = emptyState?.textContent || 'Nenhum evento encontrado.';
	}

	/**
	 * Reports whether both the event list and its empty-state element are available.
	 */
	isReady() {
		return super.isReady() && Boolean(this.#emptyState);
	}

	/**
	 * Registers the callbacks invoked by each event action button.
	 */
	bindActions({ onEdit, onDelete } = {}) {
		this.#onEdit = typeof onEdit === 'function' ? onEdit : null;
		this.#onDelete = typeof onDelete === 'function' ? onDelete : null;
		return this;
	}

	/**
	 * Renders the member events sorted by descending event date.
	 */
	render(events, { emptyMessage } = {}) {
		if (!this.isReady()) {
			return this;
		}

		const sortedEvents = sortEventsByDateDescending(events);
		this.#emptyState.textContent = emptyMessage || this.#defaultEmptyMessage;

		if (sortedEvents.length === 0) {
			this.get().replaceChildren();
			this.get().hidden = true;
			this.#emptyState.hidden = false;
			return this;
		}

		const fragment = document.createDocumentFragment();
		sortedEvents.forEach((event) => {
			fragment.appendChild(this.#createCard(event));
		});

		this.get().replaceChildren(fragment);
		this.get().hidden = false;
		this.#emptyState.hidden = true;
		return this;
	}

	/**
	 * Clears the rendered events while preserving the empty-state flow.
	 */
	clear({ emptyMessage } = {}) {
		return this.render([], { emptyMessage });
	}

	/**
	 * Builds the dashboard card shown for one member event.
	 */
	#createCard(event) {
		const status = describeMemberEventStatus(event?.status);
		const eventData = event && typeof event === 'object' ? { ...event } : {};
		const card = document.createElement('article');
		card.className = `member-event-card member-event-card--${status.value}`;

		if (isPastEvent(eventData)) {
			card.classList.add('member-event-card--past');
		}

		const header = document.createElement('div');
		header.className = 'member-event-card__header';

		const titleGroup = document.createElement('div');
		titleGroup.className = 'member-event-card__title-group';

		const title = document.createElement('h4');
		title.textContent = readText(eventData.title, 'Sem título');
		titleGroup.appendChild(title);

		const statusBadge = document.createElement('span');
		statusBadge.className = `member-event-card__status member-event-card__status--${status.value}`;
		statusBadge.textContent = status.label;
		header.appendChild(titleGroup);
		header.appendChild(statusBadge);

		const description = document.createElement('p');
		description.className = 'member-event-card__description';
		description.textContent = readText(eventData.description, 'Sem descrição.');

		const meta = document.createElement('div');
		meta.className = 'member-event-card__meta';
		[
			readText(eventData.category, 'Geral'),
			readText(eventData.location, 'A definir'),
			formatDateTimePtBr(eventData.date),
		].forEach((value) => {
			meta.appendChild(createMetaItem(value));
		});

		const footer = document.createElement('div');
		footer.className = 'member-event-card__footer';

		const note = document.createElement('p');
		note.className = 'member-event-card__note';
		note.textContent = status.description;
		footer.appendChild(note);

		const actions = document.createElement('div');
		actions.className = 'member-event-card__actions';

		if (canManageMemberEvent(eventData)) {
			actions.appendChild(createActionButton({
				text: 'Editar',
				className: 'button--primary',
				manageBusy: false,
				onClick: () => this.#onEdit?.({ ...eventData }),
			}));

			actions.appendChild(createActionButton({
				text: 'Excluir',
				className: 'button--ghost dashboard-button-danger',
				loadingLabel: 'Excluindo...',
				manageBusy: true,
				onClick: () => this.#onDelete?.({ ...eventData }),
			}));
		} else {
			const notice = document.createElement('span');
			notice.className = 'member-event-card__locked';
			notice.textContent = 'Eventos publicados permanecem disponíveis apenas para consulta.';
			actions.appendChild(notice);
		}

		footer.appendChild(actions);

		card.replaceChildren(header, description, meta, footer);
		return card;
	}
}