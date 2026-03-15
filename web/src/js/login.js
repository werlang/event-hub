import '../css/login.css';

import { AuthTabs } from './components/auth-tabs.js';
import { Form } from './components/form.js';
import { Toast } from './components/toast.js';
import { requestApi, storeToken } from './helpers/api.js';
import { getCurrentSession } from './helpers/session.js';
import { TemplateVar } from './helpers/template-var.js';
import { Header } from './components/header.js';

new Header();

const LOGIN_TAB = 'login';
const REGISTER_TAB = 'register';
const SUBMIT_STATE_KEY = 'submitting';
const AUTH_TOAST_GROUP = 'auth-status';
const AUTH_REDIRECT_TOAST_GROUP = 'auth-redirect';

/**
 * Collects the login page elements used by the auth flow.
 */
function createElements() {
    return {
        tabs: Array.from(document.querySelectorAll('.tabs .tab[data-tab]')),
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
    const defaultRedirect = '/dashboard';
    const templateRedirect = TemplateVar.get('redirect');
    const queryRedirect = new URLSearchParams(window.location.search).get('redirect');
    const rawTarget = typeof templateRedirect === 'string' && templateRedirect
        ? templateRedirect
        : queryRedirect || defaultRedirect;

    if (typeof rawTarget !== 'string' || !rawTarget.startsWith('/')) {
        return defaultRedirect;
    }

    if (rawTarget.startsWith('//') || rawTarget.startsWith('/login')) {
        return defaultRedirect;
    }

    return rawTarget;
}

/**
 * Clears any visible auth toast associated with the current page.
 */
function clearAuthToasts() {
    Toast.dismissGroup(AUTH_TOAST_GROUP);
}

/**
 * Shows one authentication toast using the shared notification pattern.
 */
function showAuthToast(text, tone = 'error') {
    const normalizedText = typeof text === 'string' ? text.trim() : '';
    if (!normalizedText) {
        return null;
    }

    return Toast.show(normalizedText, {
        tone,
        group: AUTH_TOAST_GROUP,
        duration: tone === 'success' ? 4200 : 5600,
    });
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
async function submitLogin({ form, values }) {
    const email = String(values.email || '').trim();
    const password = String(values.password || '');
    form.disable({ stateKey: SUBMIT_STATE_KEY });
    clearAuthToasts();

    try {
        const response = await requestApi('/auth/login', {
            method: 'POST',
            body: {
                email,
                password,
            },
        });

        if (!response.ok) {
            showAuthToast(response.message || 'Não foi possível autenticar.');
            return;
        }

        const token = response.data?.token;
        if (!token) {
            showAuthToast('Resposta de autenticação inválida.');
            return;
        }

        storeToken(token);
        Toast.flash('Login realizado com sucesso.', {
            tone: 'success',
            group: AUTH_REDIRECT_TOAST_GROUP,
        });
        window.location.assign(readRedirectTarget());
    } finally {
        form.enable({ stateKey: SUBMIT_STATE_KEY });
    }
}

/**
 * Submits the register form and starts the new session when successful.
 */
async function submitRegister({ form, values }) {
    const name = String(values.name || '').trim();
    const email = String(values.email || '').trim();
    const password = String(values.password || '');
    const confirmPassword = String(values.confirmPassword || '');

    if (!name || !email || !password) {
        showAuthToast('Preencha nome, e-mail e senha para continuar.');
        return;
    }

    if (password !== confirmPassword) {
        showAuthToast('A confirmação de senha não confere.');
        form.getField('confirmPassword')?.focus();
        return;
    }

    form.disable({ stateKey: SUBMIT_STATE_KEY });
    clearAuthToasts();

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
            showAuthToast(response.message || 'Não foi possível concluir o registro.');
            return;
        }

        const token = response.data?.token;
        if (!token) {
            showAuthToast('Resposta de autenticação inválida.');
            return;
        }

        storeToken(token);
        Toast.flash('Conta criada com sucesso. Redirecionando...', {
            tone: 'success',
            group: AUTH_REDIRECT_TOAST_GROUP,
        });
        window.location.assign(readRedirectTarget());
    } finally {
        form.enable({ stateKey: SUBMIT_STATE_KEY });
    }
}

/**
 * Validates the current stored session to inform the login screen.
 */
async function checkCurrentSession() {
    const session = await getCurrentSession();
    if (!session.isAuthenticated) {
        return;
    }

    const userName = session.user?.name;
    if (userName) {
        showAuthToast(`Sessão ativa como ${userName}. Você pode entrar novamente para trocar de conta.`, 'success');
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
        });
    });

    registerForm.submit(async (values, form) => {
        await submitRegister({
            form,
            values,
        });
    });

    checkCurrentSession();
}

initAuthTabs();
