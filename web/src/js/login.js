import '../css/login.css';

import { AuthTabs } from './components/auth-tabs.js';
import { Form } from './components/form.js';
import { Toast } from './components/toast.js';
import { getCurrentSession } from './helpers/session.js';
import { TemplateVar } from './helpers/template-var.js';
import { Header } from './components/header.js';
import { authApi } from './model/auth.js';
import { userApi } from './model/users.js';

new Header();

const LOGIN_TAB = 'login';
const REGISTER_TAB = 'register';
const RESET_REQUEST_VIEW = 'reset-request';
const RESET_PASSWORD_VIEW = 'reset-password';
const AUTH_TOAST_GROUP = 'auth-status';
const AUTH_REDIRECT_TOAST_GROUP = 'auth-redirect';
const VISIBILITY_STATE_KEY = 'visibility';

/**
 * Collects the login page elements used by the auth flow.
 */
function createElements() {
    return {
        tabs: Array.from(document.querySelectorAll('.tabs .tab[data-tab]')),
        tabsContainer: document.querySelector('.tabs'),
        loginForm: document.querySelector('#login-form'),
        registerForm: document.querySelector('#register-form'),
        passwordResetRequestForm: document.querySelector('#password-reset-request-form'),
        passwordResetForm: document.querySelector('#password-reset-form'),
        passwordResetTokenInput: document.querySelector('#password-reset-token'),
        forgotPasswordButton: document.querySelector('#forgot-password-link'),
        authViewButtons: Array.from(document.querySelectorAll('[data-auth-view]')),
    };
}

/**
 * Reads the initial tab state from the current URL hash.
 */
function readInitialAuthTab() {
    return window.location.hash === '#register' ? REGISTER_TAB : LOGIN_TAB;
}

/**
 * Reads the one-time reset token supplied by the reset-password route.
 */
function readResetToken() {
    const templateToken = TemplateVar.get('resetToken');
    if (typeof templateToken === 'string' && templateToken.trim()) {
        return templateToken.trim();
    }

    return new URLSearchParams(window.location.search).get('token') || '';
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
 * Synchronizes one form's visual and interactive visibility state.
 */
function setFormVisible(form, isVisible) {
    if (!form?.isReady()) {
        return;
    }

    const element = form.get();
    element.classList.toggle('form--visible', isVisible);
    element.hidden = !isVisible;
    element.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
    form.setEnabled(isVisible, { stateKey: VISIBILITY_STATE_KEY });
}

/**
 * Shows the requested authentication page state and hides the others.
 */
function showAuthView(view, { elements, forms, authTabs }) {
    const isResetRequest = view === RESET_REQUEST_VIEW;
    const isResetPassword = view === RESET_PASSWORD_VIEW;
    const isAuthTabsView = !isResetRequest && !isResetPassword;

    if (elements.tabsContainer) {
        elements.tabsContainer.hidden = !isAuthTabsView;
    }

    if (isAuthTabsView) {
        authTabs.setActive(view === REGISTER_TAB ? REGISTER_TAB : LOGIN_TAB);
    } else {
        setFormVisible(forms.login, false);
        setFormVisible(forms.register, false);
    }

    setFormVisible(forms.passwordResetRequest, isResetRequest);
    setFormVisible(forms.passwordReset, isResetPassword);
}

/**
 * Submits login credentials and redirects after a successful response.
 */
async function submitLogin({ form, values }) {
    const email = String(values.email || '').trim();
    const password = String(values.password || '');
    clearAuthToasts();

    const response = await authApi.login({
        email,
        password,
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

    authApi.storeToken(token);
    Toast.flash('Login realizado com sucesso.', {
        tone: 'success',
        group: AUTH_REDIRECT_TOAST_GROUP,
    });
    window.location.assign(readRedirectTarget());
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

    clearAuthToasts();

    const response = await authApi.register({
        name,
        email,
        password,
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

    authApi.storeToken(token);
    Toast.flash('Conta criada com sucesso. Redirecionando...', {
        tone: 'success',
        group: AUTH_REDIRECT_TOAST_GROUP,
    });
    window.location.assign(readRedirectTarget());
}

/**
 * Requests a one-time password-reset link for the submitted e-mail.
 */
async function submitPasswordResetRequest({ form, values, showLoginView = null }) {
    const email = String(values.email || '').trim();

    if (!email) {
        showAuthToast('Informe o e-mail da conta.');
        form.getField('email')?.focus();
        return;
    }

    clearAuthToasts();

    const response = await userApi.requestPasswordReset(email);

    if (!response.ok) {
        showAuthToast(response.message || 'Não foi possível solicitar a redefinição.');
        return;
    }

    form.reset();
    showAuthToast(response.message || 'Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.', 'success');
    showLoginView?.();
}

/**
 * Consumes a one-time reset token and stores the submitted new password.
 */
async function submitPasswordResetConfirmation({ form, values, showLoginView = null }) {
    const token = String(values.token || readResetToken() || '').trim();
    const newPassword = String(values.newPassword || '');
    const confirmPassword = String(values.confirmPassword || '');

    if (!token || !newPassword) {
        showAuthToast('Informe a nova senha para continuar.');
        form.getField('newPassword')?.focus();
        return;
    }

    if (newPassword !== confirmPassword) {
        showAuthToast('A confirmação de senha não confere.');
        form.getField('confirmPassword')?.focus();
        return;
    }

    clearAuthToasts();

    const response = await userApi.confirmPasswordReset({
        token,
        newPassword,
    });

    if (!response.ok) {
        showAuthToast(response.message || 'Não foi possível redefinir a senha.');
        return;
    }

    form.reset();
    window.history?.replaceState?.(null, '', '/login');
    showAuthToast(response.message || 'Senha redefinida. Você já pode entrar com a nova senha.', 'success');
    showLoginView?.();
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
    const passwordResetRequestForm = new Form(elements.passwordResetRequestForm);
    const passwordResetForm = new Form(elements.passwordResetForm);

    if (!elements.tabs.length
        || !loginForm.isReady()
        || !registerForm.isReady()
        || !passwordResetRequestForm.isReady()
        || !passwordResetForm.isReady()) {
        return;
    }

    configureSubmitButton(loginForm, 'Entrando...');
    configureSubmitButton(registerForm, 'Criando conta...');
    configureSubmitButton(passwordResetRequestForm, 'Enviando...');
    configureSubmitButton(passwordResetForm, 'Atualizando...');

    const authTabs = new AuthTabs({
        tabs: elements.tabs,
        loginForm,
        registerForm,
        onChange: syncAuthHash,
    });
    const authViewByButton = new Map();
    elements.authViewButtons.forEach((button) => {
        authViewByButton.set(button, button.dataset.authView || LOGIN_TAB);
    });
    const forms = {
        login: loginForm,
        register: registerForm,
        passwordResetRequest: passwordResetRequestForm,
        passwordReset: passwordResetForm,
    };
    const showLoginView = () => showAuthView(LOGIN_TAB, { elements, forms, authTabs });

    authTabs.setRegisterEnabled(true);
    authTabs.wire();

    elements.forgotPasswordButton?.addEventListener('click', () => {
        showAuthView(RESET_REQUEST_VIEW, { elements, forms, authTabs });
    });

    elements.authViewButtons.forEach((button) => {
        button.addEventListener('click', () => {
            showAuthView(authViewByButton.get(button) || LOGIN_TAB, { elements, forms, authTabs });
        });
    });

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

    passwordResetRequestForm.submit(async (values, form) => {
        await submitPasswordResetRequest({
            form,
            values,
            showLoginView,
        });
    });

    passwordResetForm.submit(async (values, form) => {
        await submitPasswordResetConfirmation({
            form,
            values,
            showLoginView,
        });
    });

    const resetToken = readResetToken();
    if (resetToken) {
        elements.passwordResetTokenInput.value = resetToken;
        showAuthView(RESET_PASSWORD_VIEW, { elements, forms, authTabs });
    } else {
        showAuthView(readInitialAuthTab(), { elements, forms, authTabs });
        checkCurrentSession();
    }
}

initAuthTabs();
