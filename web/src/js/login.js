import { TemplateVar } from './helpers/template-var.js';
import { requestApi, clearToken, readToken, storeToken } from './helpers/api.js';

const elements = {
	tabs: document.querySelectorAll('.tab'),
	loginForm: document.querySelector('#login-form'),
	registerForm: document.querySelector('#register-form'),
	message: document.querySelector('#auth-message'),
};

function showMessage(text, isError = true) {
	if (!elements.message) {
		return;
	}

	elements.message.hidden = false;
	elements.message.textContent = text;
	elements.message.style.borderColor = isError
		? 'rgba(250, 204, 21, 0.5)'
		: 'rgba(34, 197, 94, 0.6)';
	elements.message.style.background = isError
		? 'rgba(250, 204, 21, 0.14)'
		: 'rgba(34, 197, 94, 0.15)';
	elements.message.style.color = isError ? '#fde68a' : '#bbf7d0';
}

function setActiveTab(tab) {
	elements.tabs.forEach(button => {
		button.classList.toggle('tab--active', button.dataset.tab === tab);
	});

	if (elements.loginForm) {
		elements.loginForm.classList.toggle('form--visible', tab === 'login');
	}
	if (elements.registerForm) {
		elements.registerForm.classList.toggle('form--visible', tab === 'register');
	}
}

function redirectAfterAuth() {
	const redirect = TemplateVar.get('redirect');
	const target = redirect && typeof redirect === 'string' ? redirect : '/publish';
	window.location.assign(target);
}

function parseForm(form) {
	return Object.fromEntries(new FormData(form).entries());
}

async function submitAuth(form, endpoint) {
	const payload = parseForm(form);
	const response = await requestApi(endpoint, {
		method: 'POST',
		body: payload,
	});

	if (!response.ok) {
		showMessage(response.message || 'Não foi possível autenticar.', true);
		return;
	}

	const token = response.data?.token;
	if (!token) {
		showMessage('Resposta de autenticação inválida.', true);
		return;
	}

	storeToken(token);
	showMessage('Autenticação concluída com sucesso.', false);
	window.setTimeout(redirectAfterAuth, 250);
}

function wireAuthSubmit() {
	if (elements.loginForm) {
		elements.loginForm.addEventListener('submit', async event => {
			event.preventDefault();
			await submitAuth(elements.loginForm, '/auth/login');
		});
	}

	if (elements.registerForm) {
		elements.registerForm.addEventListener('submit', async event => {
			event.preventDefault();
			await submitAuth(elements.registerForm, '/auth/register');
		});
	}
}

function wireTabs() {
	elements.tabs.forEach(button => {
		button.addEventListener('click', () => {
			setActiveTab(button.dataset.tab || 'login');
		});
	});
}

async function checkCurrentSession() {
	const token = readToken();
	if (!token) {
		return;
	}

	const response = await requestApi('/auth/me', { token });
	if (!response.ok) {
		clearToken();
		return;
	}

	const userName = response.data?.user?.name;
	if (userName) {
		showMessage(`Sessão ativa como ${userName}.`, false);
	}
}

export function initLoginPage() {
	if (!elements.loginForm || !elements.registerForm) {
		return;
	}

	wireTabs();
	wireAuthSubmit();
	setActiveTab('login');
	checkCurrentSession();
}