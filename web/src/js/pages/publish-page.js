import { TemplateVar } from '../helpers/template-var.js';
import { apiClient, authTokenStore } from '../helpers/api.js';
import { StatusAlert } from '../components/status-alert.js';
import { setFormEnabled } from '../components/form-state.js';
import { EventForm } from '../components/event-form.js';

function getElements() {
	return {
		authState: document.querySelector('#auth-state'),
		eventForm: document.querySelector('#event-form'),
		successToast: document.querySelector('#event-success'),
	};
}

function getLoginRedirectUrl() {
	const redirect = TemplateVar.get('redirect');
	const target = redirect && typeof redirect === 'string' ? redirect : '/publish';
	return `/login?redirect=${encodeURIComponent(target)}`;
}

function showSuccess(element) {
	if (!element) {
		return;
	}

	element.hidden = false;
	window.setTimeout(() => {
		element.hidden = true;
	}, 3500);
}

export async function initPublishPage() {
	const elements = getElements();
	if (!elements.eventForm) {
		return;
	}

	const alert = new StatusAlert(elements.authState);
	const eventForm = new EventForm(elements.eventForm);
	eventForm.bind();
	setFormEnabled(elements.eventForm, false);

	const token = authTokenStore.read();
	if (!token) {
		alert.show('Faça login para publicar um evento.', { isError: true });
		return;
	}

	const me = await apiClient.request('/auth/me', { token });
	if (!me.ok) {
		authTokenStore.clear();
		setFormEnabled(elements.eventForm, false);
		alert.show('Sessão inválida ou expirada. Entre novamente para publicar.', { isError: true });
		window.setTimeout(() => {
			window.location.assign(getLoginRedirectUrl());
		}, 700);
		return;
	}

	const userName = me.data?.user?.name || 'usuário autenticado';
	setFormEnabled(elements.eventForm, true);
	alert.show(`Sessão ativa: ${userName}.`, { isError: false });

	elements.eventForm.addEventListener('submit', async event => {
		event.preventDefault();
		alert.hide();

		if (!elements.eventForm.reportValidity()) {
			return;
		}

		const parsed = eventForm.toPayload();
		if (!parsed.ok) {
			alert.show(parsed.message, { isError: true });
			return;
		}

		const response = await apiClient.request('/events', {
			method: 'POST',
			token,
			body: parsed.payload,
		});

		if (!response.ok) {
			alert.show(response.message || 'Não foi possível publicar o evento.', { isError: true });
			return;
		}

		showSuccess(elements.successToast);
		eventForm.reset();
		alert.show('Evento publicado com sucesso.', { isError: false });
	});
}
