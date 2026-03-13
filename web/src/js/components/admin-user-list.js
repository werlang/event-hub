import { BaseComponent } from './base-component.js';
import { Button } from './button.js';

/**
 * Normalizes user-facing text while preserving a fallback label.
 */
function readText(value, fallback) {
	if (typeof value !== 'string') {
		return fallback;
	}

	const normalizedValue = value.trim();
	return normalizedValue || fallback;
}

/**
 * Returns the dashboard copy used for one administrative role.
 */
function describeUserRole(role) {
	const normalizedRole = typeof role === 'string'
		? role.trim().toLowerCase()
		: 'member';

	if (normalizedRole === 'admin') {
		return {
			value: 'admin',
			label: 'Administrador',
			note: 'Esta conta já possui acesso administrativo.',
		};
	}

	return {
		value: 'member',
		label: 'Membro',
		note: 'Esta conta pode receber acesso administrativo.',
	};
}

/**
 * Reports whether one user can still be promoted by the dashboard.
 */
export function isPromotableUser(user) {
	return describeUserRole(user?.role).value !== 'admin';
}

/**
 * Returns a stable alphabetical ordering for dashboard users.
 */
function sortUsersByName(users) {
	return [...(Array.isArray(users) ? users : [])].sort((left, right) => {
		const leftName = readText(left?.name, '');
		const rightName = readText(right?.name, '');
		return leftName.localeCompare(rightName, 'pt-BR', { sensitivity: 'base' });
	});
}

/**
 * Creates one dashboard action button backed by the shared button wrapper.
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

export class AdminUserList extends BaseComponent {
	#emptyState;
	#defaultEmptyMessage;
	#onPromote = null;

	/**
	 * Creates the admin user list wrapper used by the dashboard.
	 */
	constructor({ list, emptyState } = {}) {
		super(list || null);
		this.#emptyState = emptyState || null;
		this.#defaultEmptyMessage = emptyState?.textContent || 'Nenhum usuário disponível.';
	}

	/**
	 * Reports whether both the list and its empty-state element are available.
	 */
	isReady() {
		return super.isReady() && Boolean(this.#emptyState);
	}

	/**
	 * Registers the callback used when the promote button is clicked.
	 */
	bindActions({ onPromote } = {}) {
		this.#onPromote = typeof onPromote === 'function' ? onPromote : null;
		return this;
	}

	/**
	 * Renders the dashboard list of promotable users.
	 */
	render(users, { emptyMessage } = {}) {
		if (!this.isReady()) {
			return this;
		}

		const sortedUsers = sortUsersByName(users);
		this.#emptyState.textContent = emptyMessage || this.#defaultEmptyMessage;

		if (sortedUsers.length === 0) {
			this.get().replaceChildren();
			this.get().hidden = true;
			this.#emptyState.hidden = false;
			return this;
		}

		const fragment = document.createDocumentFragment();
		sortedUsers.forEach((user) => {
			fragment.appendChild(this.#createCard(user));
		});

		this.get().replaceChildren(fragment);
		this.get().hidden = false;
		this.#emptyState.hidden = true;
		return this;
	}

	/**
	 * Clears the rendered list while preserving the empty-state flow.
	 */
	clear({ emptyMessage } = {}) {
		return this.render([], { emptyMessage });
	}

	/**
	 * Builds one administrative user card.
	 */
	#createCard(user) {
		const role = describeUserRole(user?.role);
		const card = document.createElement('article');
		card.className = 'dashboard-admin-card dashboard-admin-card--user';

		const header = document.createElement('div');
		header.className = 'dashboard-admin-card__header';

		const identity = document.createElement('div');
		identity.className = 'dashboard-admin-card__identity';

		const name = document.createElement('h4');
		name.textContent = readText(user?.name, 'Usuário sem nome');

		const meta = document.createElement('p');
		meta.className = 'dashboard-admin-card__meta';
		meta.textContent = readText(user?.email, 'E-mail indisponível');

		const status = document.createElement('span');
		status.className = `dashboard-admin-card__status dashboard-admin-card__status--${role.value}`;
		status.textContent = role.label;

		identity.replaceChildren(name, meta);
		header.replaceChildren(identity, status);

		const note = document.createElement('p');
		note.className = 'dashboard-admin-card__note';
		note.textContent = role.note;

		const actions = document.createElement('div');
		actions.className = 'dashboard-admin-card__actions';

		if (isPromotableUser(user)) {
			actions.appendChild(createActionButton({
				text: 'Promover a administrador',
				className: 'button--primary',
				loadingLabel: 'Promovendo...',
				onClick: async () => {
					await this.#onPromote?.({ ...user });
				},
			}));
		} else {
			const locked = document.createElement('span');
			locked.className = 'dashboard-admin-card__locked';
			locked.textContent = 'Nenhuma ação adicional é necessária.';
			actions.appendChild(locked);
		}

		card.replaceChildren(header, note, actions);
		return card;
	}
}