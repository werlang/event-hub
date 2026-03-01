import { requestApi, clearToken, readToken, storeToken } from '../helpers/api.js';
import { TemplateVar } from '../helpers/template-var.js';
import { StatusAlert } from '../components/status-alert.js';
import { AuthTabs } from '../components/auth-tabs.js';
import { SessionBadge } from '../components/session-badge.js';
import { readInviteTokenFromUrl } from '../helpers/invite-token.js';

function getElements() {
	return {
		tabs: Array.from(document.querySelectorAll('.tab')),
		loginForm: document.querySelector('#login-form'),
		registerForm: document.querySelector('#register-form'),
		message: document.querySelector('#auth-message'),
		inviteHint: document.querySelector('#invite-hint'),
		sessionBadge: document.querySelector('#session-badge'),
	};
}

function parseForm(form) {
	return Object.fromEntries(new FormData(form).entries());
}

function redirectAfterAuth() {
	const redirect = TemplateVar.get('redirect');
	const target = redirect && typeof redirect === 'string' ? redirect : '/publish';
	window.location.assign(target);
}

export function initLoginPage() {
	const elements = getElements();
	if (!elements.loginForm || !elements.registerForm) {
		return;
	}

	const alert = new StatusAlert(elements.message);
	const sessionBadge = new SessionBadge(elements.sessionBadge);
	const tabs = new AuthTabs({
		tabs: elements.tabs,
		loginForm: elements.loginForm,
		registerForm: elements.registerForm,
	});
	const inviteState = readInviteTokenFromUrl();
	const inviteTokenInput = elements.registerForm.querySelector('input[name="inviteToken"]');

	const applyInviteState = current => {
		const isReady = current.status === 'ready';
		tabs.setRegisterEnabled(isReady);

		if (inviteTokenInput) {
			inviteTokenInput.value = isReady ? current.token : '';
		}

		if (elements.inviteHint) {
			elements.inviteHint.textContent = current.message;
		}

		if (isReady) {
			alert.show(current.message, { isError: false });
			return;
		}

		alert.show(current.message, { isError: true });
		tabs.setActive('login');
	};

	const submitAuth = async (form, endpoint) => {
		const response = await requestApi(endpoint, {
			method: 'POST',
			body: parseForm(form),
		});

		if (!response.ok) {
			alert.show(response.message || 'Não foi possível autenticar.', { isError: true });
			return;
		}

		const token = response.data?.token;
		if (!token) {
			alert.show('Resposta de autenticação inválida.', { isError: true });
			return;
		}

		storeToken(token);
		alert.show('Autenticação concluída com sucesso.', { isError: false });
		window.setTimeout(redirectAfterAuth, 250);
	};

	elements.loginForm.addEventListener('submit', async event => {
		event.preventDefault();
		await submitAuth(elements.loginForm, '/auth/login');
	});

	elements.registerForm.addEventListener('submit', async event => {
		event.preventDefault();
		if (!tabs.registerEnabled) {
			alert.show('Registro indisponível sem convite válido.', { isError: true });
			return;
		}

		const response = await requestApi('/auth/register', {
			method: 'POST',
			body: parseForm(elements.registerForm),
		});

		if (!response.ok) {
			const shouldDisableByToken = response.status === 400 || response.status === 409 || response.status === 410;
			if (shouldDisableByToken) {
				applyInviteState({
					status: 'invalid',
					token: '',
					message: response.message || 'Convite inválido, expirado ou já utilizado.',
				});
				return;
			}

			alert.show(response.message || 'Não foi possível autenticar.', { isError: true });
			return;
		}

		const token = response.data?.token;
		if (!token) {
			alert.show('Resposta de autenticação inválida.', { isError: true });
			return;
		}

		storeToken(token);
		alert.show('Autenticação concluída com sucesso.', { isError: false });
		window.setTimeout(redirectAfterAuth, 250);
	});

	tabs.wire();
	applyInviteState(inviteState);
	tabs.setActive('login');
	sessionBadge.setChecking();

	const token = readToken();
	if (!token) {
		sessionBadge.setAnonymous();
		return;
	}

	requestApi('/auth/me', { token }).then(response => {
		if (!response.ok) {
			clearToken();
			sessionBadge.setAnonymous();
			return;
		}

		const userName = response.data?.user?.name;
		if (userName) {
			alert.show(`Sessão ativa como ${userName}.`, { isError: false });
		}

		sessionBadge.setActive(userName);
	});
}
