import { BaseComponent } from './base-component.js';
import { Button } from './button.js';
import { formatDateTimePtBr } from '../helpers/date-format.js';
import { sortEventsByDateDescending } from '../helpers/event-sort.js';

/**
 * Normalizes optional text while preserving a fallback label.
 */
function readText(value, fallback) {
	if (typeof value !== 'string') {
		return fallback;
	}

	const normalizedValue = value.trim();
	return normalizedValue || fallback;
}

/**
 * Returns the moderation status copy used by admin cards.
 */
export function describeModerationStatus(status) {
	const normalizedStatus = typeof status === 'string'
		? status.trim().toLowerCase()
		: 'pending';

	if (normalizedStatus === 'rejected') {
		return {
			value: 'rejected',
			label: 'Rejeitado',
			note: 'Este envio permanece rejeitado ate que o organizador o atualize ou voce o publique.',
		};
	}

	return {
		value: 'pending',
		label: 'Em revisao',
		note: 'Aprovar publica o evento na agenda. Rejeitar devolve o envio para ajustes do organizador.',
	};
}

/**
 * Creates one compact metadata pill.
 */
function createMetaItem(text) {
	const item = document.createElement('span');
	item.textContent = text;
	return item;
}

/**
 * Creates a dashboard action button backed by the shared button wrapper.
 */
function createActionButton({ text, className, loadingLabel, onClick }) {
	const element = document.createElement('button');
	element.type = 'button';
	element.className = ['button', className].filter(Boolean).join(' ');

	const button = new Button({
		element,
		text,
		loadingLabel,
	});

	button.click(async () => {
		await onClick?.();
	});

	return element;
}

export class AdminModerationList extends BaseComponent {
	#defaultEmptyMessage;
	#emptyState;
	#onPublish = null;
	#onReject = null;
	#resolveOrganizer = null;

	/**
	 * Creates the moderation queue list wrapper used by the dashboard.
	 */
	constructor({ list, emptyState, resolveOrganizer } = {}) {
		super(list || null);
		this.#emptyState = emptyState || null;
		this.#defaultEmptyMessage = emptyState?.textContent || 'Nenhum evento encontrado.';
		this.setOrganizerResolver(resolveOrganizer);
	}

	/**
	 * Reports whether both the list and its empty-state element are available.
	 */
	isReady() {
		return super.isReady() && Boolean(this.#emptyState);
	}

	/**
	 * Registers the callbacks used by the moderation action buttons.
	 */
	bindActions({ onPublish, onReject } = {}) {
		this.#onPublish = typeof onPublish === 'function' ? onPublish : null;
		this.#onReject = typeof onReject === 'function' ? onReject : null;
		return this;
	}

	/**
	 * Stores the organizer lookup used to enrich moderation cards.
	 */
	setOrganizerResolver(resolveOrganizer) {
		this.#resolveOrganizer = typeof resolveOrganizer === 'function' ? resolveOrganizer : null;
		return this;
	}

	/**
	 * Renders the moderation queue ordered by descending event date.
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
	 * Clears the rendered queue while preserving the empty-state flow.
	 */
	clear({ emptyMessage } = {}) {
		return this.render([], { emptyMessage });
	}

	/**
	 * Builds one moderation card with organizer context and action buttons.
	 */
	#createCard(event) {
		const status = describeModerationStatus(event?.status);
		const organizer = this.#resolveOrganizer?.(event) || null;
		const organizerName = readText(organizer?.name, 'Organizador nao identificado');
		const organizerEmail = readText(organizer?.email, event?.organizerId || 'ID indisponivel');
		const card = document.createElement('article');
		card.className = `dashboard-moderation-card dashboard-moderation-card--${status.value}`;

		const header = document.createElement('div');
		header.className = 'dashboard-moderation-card__header';

		const identity = document.createElement('div');
		identity.className = 'dashboard-moderation-card__identity';

		const title = document.createElement('h4');
		title.textContent = readText(event?.title, 'Evento sem titulo');

		const organizerText = document.createElement('p');
		organizerText.className = 'dashboard-moderation-card__organizer';
		organizerText.textContent = `Organizador: ${organizerName} - ${organizerEmail}`;

		const statusBadge = document.createElement('span');
		statusBadge.className = `dashboard-moderation-card__status dashboard-moderation-card__status--${status.value}`;
		statusBadge.textContent = status.label;

		identity.replaceChildren(title, organizerText);
		header.replaceChildren(identity, statusBadge);

		const description = document.createElement('p');
		description.className = 'dashboard-moderation-card__description';
		description.textContent = readText(event?.description, 'Sem descricao enviada.');

		const meta = document.createElement('div');
		meta.className = 'dashboard-moderation-card__meta';
		[
			readText(event?.category, 'Geral'),
			readText(event?.location, 'A definir'),
			formatDateTimePtBr(event?.date),
		].forEach((value) => {
			meta.appendChild(createMetaItem(value));
		});

		const note = document.createElement('p');
		note.className = 'dashboard-moderation-card__note';
		note.textContent = status.note;

		const actions = document.createElement('div');
		actions.className = 'dashboard-moderation-card__actions';
		actions.appendChild(createActionButton({
			text: 'Publicar',
			className: 'button--primary',
			loadingLabel: 'Publicando...',
			onClick: async () => {
				await this.#onPublish?.({ ...event });
			},
		}));

		if (status.value === 'pending') {
			actions.appendChild(createActionButton({
				text: 'Rejeitar',
				className: 'button--ghost dashboard-button-danger',
				loadingLabel: 'Rejeitando...',
				onClick: async () => {
					await this.#onReject?.({ ...event });
				},
			}));
		} else {
			const locked = document.createElement('span');
			locked.className = 'dashboard-moderation-card__locked';
			locked.textContent = 'Este evento ja se encontra rejeitado.';
			actions.appendChild(locked);
		}

		card.replaceChildren(header, description, meta, note, actions);
		return card;
	}
}