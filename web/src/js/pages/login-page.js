import { requestApi, clearToken, readToken, storeToken } from '../helpers/api.js';
import { TemplateVar } from '../helpers/template-var.js';
import { StatusAlert } from '../components/status-alert.js';
import { AuthTabs } from '../components/auth-tabs.js';

function getElements() {
	return {
		tabs: Array.from(document.querySelectorAll('.tab')),
		loginForm: document.querySelector('#login-form'),
		registerForm: document.querySelector('#register-form'),
		message: document.querySelector('#auth-message'),
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
	const tabs = new AuthTabs({
		tabs: elements.tabs,
		loginForm: elements.loginForm,
		registerForm: elements.registerForm,
	});

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
		await submitAuth(elements.registerForm, '/auth/register');
	});

	tabs.wire();
	tabs.setActive('login');

	const token = readToken();
	if (!token) {
		return;
	}

	requestApi('/auth/me', { token }).then(response => {
		if (!response.ok) {
			clearToken();
			return;
		}

		const userName = response.data?.user?.name;
		if (userName) {
			alert.show(`Sessão ativa como ${userName}.`, { isError: false });
		}
	});
}
