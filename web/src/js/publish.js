import { TemplateVar } from './helpers/template-var.js';
import { requestApi, readToken, clearToken } from './helpers/api.js';

const elements = {
	authState: document.querySelector('#auth-state'),
	eventForm: document.querySelector('#event-form'),
	successToast: document.querySelector('#event-success'),
};

function showAuthState(message, isError = true) {
	if (!elements.authState) {
		return;
	}

	elements.authState.hidden = false;
	elements.authState.textContent = message;
	elements.authState.style.borderColor = isError
		? 'rgba(250, 204, 21, 0.5)'
		: 'rgba(34, 197, 94, 0.6)';
	elements.authState.style.background = isError
		? 'rgba(250, 204, 21, 0.14)'
		: 'rgba(34, 197, 94, 0.15)';
	elements.authState.style.color = isError ? '#fde68a' : '#bbf7d0';
}

function hideAuthState() {
	if (!elements.authState) {
		return;
	}

	elements.authState.hidden = true;
	elements.authState.textContent = '';
}

function setFormEnabled(enabled) {
	if (!elements.eventForm) {
		return;
	}

	elements.eventForm.classList.toggle('form--disabled', !enabled);
	elements.eventForm.querySelectorAll('input, select, textarea, button').forEach(field => {
		field.disabled = !enabled;
	});
}

function toEventPayload(form) {
	const data = Object.fromEntries(new FormData(form).entries());
	return {
		title: data.title,
		description: data.description,
		category: data.category,
		location: data.location,
		audience: data.audience,
		date: data.date,
	};
}

function showSuccess() {
	if (!elements.successToast) {
		return;
	}

	elements.successToast.hidden = false;
	window.setTimeout(() => {
		elements.successToast.hidden = true;
	}, 3500);
}

function getLoginRedirectUrl() {
	const redirect = TemplateVar.get('redirect');
	const target = redirect && typeof redirect === 'string' ? redirect : '/publish';
	return `/login?redirect=${encodeURIComponent(target)}`;
}

async function ensureAuthenticated() {
	const token = readToken();
	if (!token) {
		setFormEnabled(false);
		showAuthState('Faça login para publicar um evento.', true);
		return null;
	}

	const response = await requestApi('/auth/me', { token });
	if (!response.ok) {
		clearToken();
		setFormEnabled(false);
		showAuthState('Sessão inválida ou expirada. Entre novamente para publicar.', true);
		window.setTimeout(() => {
			window.location.assign(getLoginRedirectUrl());
		}, 700);
		return null;
	}

	const userName = response.data?.user?.name || 'usuário autenticado';
	setFormEnabled(true);
	showAuthState(`Sessão ativa: ${userName}.`, false);
	return token;
}

function wirePublishSubmit(token) {
	if (!elements.eventForm) {
		return;
	}

	elements.eventForm.addEventListener('submit', async event => {
		event.preventDefault();
		hideAuthState();

		const payload = toEventPayload(elements.eventForm);
		const response = await requestApi('/events', {
			method: 'POST',
			token,
			body: payload,
		});

		if (!response.ok) {
			showAuthState(response.message || 'Não foi possível publicar o evento.', true);
			return;
		}

		showSuccess();
		elements.eventForm.reset();
		showAuthState('Evento publicado com sucesso.', false);
	});
}

export async function initPublishPage() {
	if (!elements.eventForm) {
		return;
	}

	setFormEnabled(false);
	const token = await ensureAuthenticated();
	if (!token) {
		return;
	}

	wirePublishSubmit(token);
}