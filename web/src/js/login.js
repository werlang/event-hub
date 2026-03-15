import '../css/login.css';

import { AuthTabs } from './components/auth-tabs.js';
import { Form } from './components/form.js';
import { requestApi, storeToken } from './helpers/api.js';
import { getCurrentSession } from './helpers/session.js';
import { TemplateVar } from './helpers/template-var.js';
import { Header } from './components/header.js';

new Header();

const LOGIN_TAB = 'login';
const REGISTER_TAB = 'register';
const SUBMIT_STATE_KEY = 'submitting';

/**
 * Collects the login page elements used by the auth flow.
 */
function createElements() {
    return {
        tabs: Array.from(document.querySelectorAll('.tabs .tab[data-tab]')),
        message: document.querySelector('#auth-message'),
        loginForm: document.querySelector('#login-form'),
        registerForm: document.querySelector('#register-form'),
    };
}

/**
 * Reads the initial tab state from the current URL hash.
 */
function readInitialAuthTab() {
    return window.location.hash === '#register' ? REGISTER_TAB : LOGIN_TAB;
}

/**
 * Keeps the URL hash aligned with the active auth tab.
 */
function syncAuthHash(activeTab) {
    const nextHash = activeTab === REGISTER_TAB ? '#register' : '';
    const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (currentUrl === nextUrl) {
        return;
    }

    window.history.replaceState(null, '', nextUrl);
}

/**
 * Reads and sanitizes the post-authentication redirect target.
 */
function readRedirectTarget() {
    const templateRedirect = TemplateVar.get('redirect');
    const queryRedirect = new URLSearchParams(window.location.search).get('redirect');
    const rawTarget = typeof templateRedirect === 'string' && templateRedirect
        ? templateRedirect
        : queryRedirect || '/';

    if (typeof rawTarget !== 'string' || !rawTarget.startsWith('/')) {
        return '/';
    }

    if (rawTarget.startsWith('//') || rawTarget.startsWith('/login')) {
        return '/';
    }

    return rawTarget;
}

/**
 * Renders the auth feedback message using the requested tone.
 */
function showMessage(messageElement, text, tone = 'error') {
    if (!messageElement) {
        return;
    }

    const normalizedText = typeof text === 'string' ? text.trim() : '';
    messageElement.hidden = !normalizedText;
    messageElement.textContent = normalizedText;
    messageElement.classList.remove('alert--error', 'alert--success');

    if (!normalizedText) {
        return;
    }

    if (tone === 'success') {
        messageElement.classList.add('alert--success');
        return;
    }

    messageElement.classList.add('alert--error');
}

/**
 * Sets the loading label shown by a form submit button.
 */
function configureSubmitButton(form, label) {
    form.getSubmitButton()?.setLoadingLabel(label);
}

/**
 * Submits login credentials and redirects after a successful response.
 */
async function submitLogin({ form, values, messageElement }) {
    const email = String(values.email || '').trim();
    const password = String(values.password || '');
    form.disable({ stateKey: SUBMIT_STATE_KEY });
    showMessage(messageElement, '');

    try {
        const response = await requestApi('/auth/login', {
            method: 'POST',
            body: {
                email,
                password,
            },
        });

        if (!response.ok) {
            showMessage(messageElement, response.message || 'Não foi possível autenticar.');
            return;
        }

        const token = response.data?.token;
        if (!token) {
            showMessage(messageElement, 'Resposta de autenticação inválida.');
            return;
        }

        storeToken(token);
        window.location.assign(readRedirectTarget());
    } finally {
        form.enable({ stateKey: SUBMIT_STATE_KEY });
    }
}

/**
 * Submits the register form and starts the new session when successful.
 */
async function submitRegister({ form, values, messageElement }) {
    const name = String(values.name || '').trim();
    const email = String(values.email || '').trim();
    const password = String(values.password || '');
    const confirmPassword = String(values.confirmPassword || '');

    if (!name || !email || !password) {
        showMessage(messageElement, 'Preencha nome, e-mail e senha para continuar.');
        return;
    }

    if (password !== confirmPassword) {
        showMessage(messageElement, 'A confirmação de senha não confere.');
        form.getField('confirmPassword')?.focus();
        return;
    }

    form.disable({ stateKey: SUBMIT_STATE_KEY });
    showMessage(messageElement, '');

    try {
        const response = await requestApi('/auth/register', {
            method: 'POST',
            body: {
                name,
                email,
                password,
            },
        });

        if (!response.ok) {
            showMessage(messageElement, response.message || 'Não foi possível concluir o registro.');
            return;
        }

        const token = response.data?.token;
        if (!token) {
            showMessage(messageElement, 'Resposta de autenticação inválida.');
            return;
        }

        storeToken(token);
        showMessage(messageElement, 'Conta criada com sucesso. Redirecionando...', 'success');
        window.setTimeout(() => {
            window.location.assign(readRedirectTarget());
        }, 150);
    } finally {
        form.enable({ stateKey: SUBMIT_STATE_KEY });
    }
}

/**
 * Validates the current stored session to inform the login screen.
 */
async function checkCurrentSession(messageElement) {
    const session = await getCurrentSession();
    if (!session.isAuthenticated) {
        return;
    }

    const userName = session.user?.name;
    const hasVisibleMessage = Boolean(messageElement?.textContent?.trim());
    if (userName && !hasVisibleMessage) {
        showMessage(messageElement, `Sessão ativa como ${userName}. Você pode entrar novamente para trocar de conta.`, 'success');
    }
}

/**
 * Boots the login page tabs and submit handlers.
 */
function initAuthTabs() {
    const elements = createElements();
    const loginForm = new Form(elements.loginForm);
    const registerForm = new Form(elements.registerForm);

    if (!elements.tabs.length || !loginForm.isReady() || !registerForm.isReady()) {
        return;
    }

    configureSubmitButton(loginForm, 'Entrando...');
    configureSubmitButton(registerForm, 'Criando conta...');

    const authTabs = new AuthTabs({
        tabs: elements.tabs,
        loginForm,
        registerForm,
        onChange: syncAuthHash,
    });

    authTabs.setRegisterEnabled(true);
    authTabs.wire();
    authTabs.setActive(readInitialAuthTab());

    loginForm.submit(async (values, form) => {
        await submitLogin({
            form,
            values,
            messageElement: elements.message,
        });
    });

    registerForm.submit(async (values, form) => {
        await submitRegister({
            form,
            values,
            messageElement: elements.message,
        });
    });

    checkCurrentSession(elements.message);
}

initAuthTabs();
