import { BaseComponent } from '../components/base-component.js';
import { Button } from '../components/button.js';
import { Form } from '../components/form.js';
import { Toast } from '../components/toast.js';
import { requestApi, storeToken } from '../helpers/api.js';
import { resetCurrentSession } from '../helpers/session.js';

const DASHBOARD_SETTINGS_TOAST_GROUP = 'dashboard-settings';
const DASHBOARD_ACTION_TOAST_GROUP = 'dashboard-action';

/**
 * Returns a safe user-facing text fallback.
 */
function readText(value, fallback) {
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    return normalizedValue || fallback;
}

/**
 * Normalizes a user e-mail for lookup and submission.
 */
function normalizeEmail(email) {
    return readText(email, '').toLowerCase();
}

/**
 * Reports whether one account role belongs to an administrator.
 */
function isAdminRole(role) {
    return readText(role, '').toLowerCase() === 'admin';
}

/**
 * Returns a localized label for the authenticated account role.
 */
function readRoleLabel(role) {
    return isAdminRole(role)
        ? 'Administrador'
        : 'Membro';
}

/**
 * Builds the next authenticated session snapshot after a profile update.
 */
function createUpdatedSession(session, response) {
    return {
        ...session,
        isAuthenticated: true,
        token: readText(response?.data?.token, session?.token || ''),
        user: response?.data?.user || session?.user || null,
        status: response?.status || session?.status || 200,
        reason: 'authenticated',
        message: null,
    };
}

export class DashboardSettingsPanels extends BaseComponent {
    #elements;
    #forms = {};
    #manualDigestButton = null;
    #session = null;
    #sessionChangeHandlers = new Set();
    #renderedProfileKey = '';
    #renderedPreferenceKey = '';

    /**
     * Creates the inline settings controller used inside the dashboard.
     */
    constructor({ section = null } = {}) {
        super(section);
        this.#elements = this.#collectElements();

        if (!this.isReady()) {
            return;
        }

        this.#forms = {
            profile: new Form(this.#elements.profileForm),
            password: new Form(this.#elements.passwordForm),
            preferences: new Form(this.#elements.preferencesForm),
            adminReset: new Form(this.#elements.adminResetForm),
            adminPromote: new Form(this.#elements.adminPromoteForm),
        };
        this.#manualDigestButton = this.#elements.adminDigestButton
            ? new Button({
                element: this.#elements.adminDigestButton,
                loadingLabel: 'Enviando agenda...',
            })
            : null;

        this.#configureButtons();
        this.#wireNavigation();
        this.#wireForms();
        this.#wireAdminActions();
        this.#updateNavigationState('profile');
    }

    /**
     * Reports whether the settings area has the required structure to boot.
     */
    isReady() {
        return Boolean(
            super.isReady()
            && this.#elements.summary
            && this.#elements.profileForm
            && this.#elements.passwordForm
            && this.#elements.preferencesForm
            && this.#elements.adminResetForm
            && this.#elements.adminPromoteForm
        );
    }

    /**
     * Registers a callback fired after the authenticated profile session changes.
     */
    onSessionChange(callback) {
        if (typeof callback === 'function') {
            this.#sessionChangeHandlers.add(callback);
        }

        return this;
    }

    /**
     * Stores the active session and refreshes the settings copy.
     */
    setSession(session = null) {
        this.#session = session && typeof session === 'object'
            ? session
            : null;
        this.render();
        return this;
    }

    /**
     * Scrolls the settings section into view and focuses its summary.
     */
    focus() {
        if (!this.isReady()) {
            return this;
        }

        this.get().open = true;
        this.get().scrollIntoView({ behavior: 'smooth', block: 'start' });
        this.#elements.summary.focus();
        return this;
    }

    /**
     * Renders the current session-derived copy and panel visibility.
     */
    render() {
        if (!this.isReady()) {
            return this;
        }

        const isAdmin = this.#isAdmin();
        const userName = readText(this.#session?.user?.name, 'Conta ativa');
        const userEmail = readText(this.#session?.user?.email, 'E-mail não informado');
        const roleLabel = readRoleLabel(this.#session?.user?.role);

        if (this.#elements.accountName) {
            this.#elements.accountName.textContent = userName;
        }

        if (this.#elements.intro) {
            this.#elements.intro.textContent = isAdmin
                ? 'Gerencie sua conta, os alertas recebidos e os usuários do dashboard.'
                : 'Gerencie os dados da sua conta, seus alertas por e-mail e mantenha sua senha atualizada.';
        }

        if (this.#elements.factName) {
            this.#elements.factName.textContent = userName;
        }

        if (this.#elements.factEmail) {
            this.#elements.factEmail.textContent = userEmail;
        }

        if (this.#elements.factRole) {
            this.#elements.factRole.textContent = roleLabel;
        }

        if (this.#elements.description) {
            this.#elements.description.textContent = isAdmin
                ? 'Atualize seus dados, ajuste os avisos por e-mail e gerencie as contas dos usuários.'
                : 'Gerencie seus dados e escolha quais avisos por e-mail deseja receber.';
        }

        if (this.#elements.badge) {
            this.#elements.badge.textContent = isAdmin ? 'Conta + administração' : 'Conta pessoal';
        }

        if (this.#elements.adminGroup) {
            this.#elements.adminGroup.hidden = !isAdmin;
        }

        if (this.#elements.adminNavButton) {
            this.#elements.adminNavButton.hidden = !isAdmin;
        }

        if (this.#elements.adminPendingPreferenceItem) {
            this.#elements.adminPendingPreferenceItem.hidden = !isAdmin;
        }

        if (this.#elements.adminPendingPreferenceField) {
            this.#elements.adminPendingPreferenceField.disabled = !isAdmin;
        }

        this.#syncProfileFields();
        this.#syncPreferenceFields();
        return this;
    }

    /**
     * Destroys tracked listeners and form wrappers.
     */
    destroy() {
        Object.values(this.#forms).forEach(form => form?.destroy());
        this.#sessionChangeHandlers.clear();
        return super.destroy();
    }

    /**
     * Collects the DOM elements used by the inline settings area.
     */
    #collectElements() {
        const section = this.get();

        return {
            summary: section?.querySelector('.dashboard-section__summary') || null,
            description: section?.querySelector('#dashboard-settings-description') || null,
            badge: section?.querySelector('#dashboard-settings-badge') || null,
            accountName: section?.querySelector('#dashboard-settings-account-name') || null,
            intro: section?.querySelector('#dashboard-settings-intro') || null,
            factName: section?.querySelector('#dashboard-settings-fact-name') || null,
            factEmail: section?.querySelector('#dashboard-settings-fact-email') || null,
            factRole: section?.querySelector('#dashboard-settings-fact-role') || null,
            nav: section?.querySelector('#dashboard-settings-nav') || null,
            navButtons: Array.from(section?.querySelectorAll('[data-dashboard-settings-anchor]') || []),
            adminNavButton: section?.querySelector('#dashboard-settings-admin-nav') || null,
            profilePanel: section?.querySelector('#dashboard-settings-panel-profile') || null,
            passwordPanel: section?.querySelector('#dashboard-settings-panel-password') || null,
            preferencesPanel: section?.querySelector('#dashboard-settings-panel-emails') || null,
            adminPanel: section?.querySelector('#dashboard-settings-panel-admin') || null,
            adminGroup: section?.querySelector('#dashboard-settings-admin-group') || null,
            profileForm: section?.querySelector('#dashboard-settings-profile-form') || null,
            passwordForm: section?.querySelector('#dashboard-settings-password-form') || null,
            preferencesForm: section?.querySelector('#dashboard-settings-preferences-form') || null,
            adminPendingPreferenceField: section?.querySelector('#dashboard-settings-email-admin-pending') || null,
            adminPendingPreferenceItem: section?.querySelector('#dashboard-settings-email-admin-pending')?.closest('.dashboard-settings-preferences-item') || null,
            adminResetForm: section?.querySelector('#dashboard-settings-admin-reset-form') || null,
            adminPromoteForm: section?.querySelector('#dashboard-settings-admin-promote-form') || null,
            adminDigestButton: section?.querySelector('#dashboard-settings-admin-digest-submit') || null,
        };
    }

    /**
     * Applies contextual loading labels to settings submit buttons.
     */
    #configureButtons() {
        this.#forms.profile.getSubmitButton()?.setLoadingLabel('Salvando perfil...');
        this.#forms.password.getSubmitButton()?.setLoadingLabel('Atualizando senha...');
        this.#forms.preferences.getSubmitButton()?.setLoadingLabel('Salvando preferências...');
        this.#forms.adminReset.getSubmitButton()?.setLoadingLabel('Redefinindo...');
        this.#forms.adminPromote.getSubmitButton()?.setLoadingLabel('Promovendo...');
        this.#manualDigestButton?.setLoadingLabel('Enviando agenda...');
    }

    /**
     * Wires the local jump buttons used inside the settings section.
     */
    #wireNavigation() {
        this.on(this.#elements.nav, 'click', (event) => {
            const button = event.target instanceof Element
                ? event.target.closest('[data-dashboard-settings-anchor]')
                : null;

            if (!button) {
                return;
            }

            this.#focusPanel(button.dataset.dashboardSettingsAnchor);
        });
    }

    /**
     * Wires each settings form to its respective API action.
     */
    #wireForms() {
        this.#forms.profile.submit(async (values, form) => {
            await this.#handleProfileSubmit(values, form);
        });

        this.#forms.password.submit(async (values, form) => {
            await this.#handlePasswordSubmit(values, form);
        });

        this.#forms.preferences.submit(async (_values, form) => {
            await this.#handlePreferencesSubmit(form);
        });

        this.#forms.adminReset.submit(async (values, form) => {
            await this.#handleAdminResetSubmit(values, form);
        });

        this.#forms.adminPromote.submit(async (values, form) => {
            await this.#handleAdminPromoteSubmit(values, form);
        });
    }

    /**
     * Wires button-only administrator actions that do not use form submission.
     */
    #wireAdminActions() {
        this.#manualDigestButton?.click(async () => {
            await this.#handleManualDigestTrigger();
        });
    }

    /**
     * Submits the authenticated profile update flow.
     */
    async #handleProfileSubmit(values, form) {
        const name = readText(values?.name, '');
        const email = normalizeEmail(values?.email);

        if (!name || !email) {
            this.#showToast('Informe nome e e-mail para atualizar o perfil.', 'error', DASHBOARD_ACTION_TOAST_GROUP);
            form.getField(!name ? 'dashboard-settings-name' : 'dashboard-settings-email')?.focus();
            return;
        }

        if (!this.#readSessionToken()) {
            this.#showToast('Não foi possível validar a sua sessão agora.', 'error', DASHBOARD_ACTION_TOAST_GROUP);
            return;
        }

        const response = await requestApi('/auth/me', {
            method: 'PUT',
            token: this.#readSessionToken(),
            body: { name, email },
        });

        if (!response.ok) {
            this.#showToast(response.message || 'Não foi possível atualizar o perfil agora.', 'error', DASHBOARD_ACTION_TOAST_GROUP);
            return;
        }

        if (!response.data?.user || !response.data?.token) {
            this.#showToast('A resposta do servidor não trouxe a sessão atualizada.', 'error', DASHBOARD_ACTION_TOAST_GROUP);
            return;
        }

        const nextSession = createUpdatedSession(this.#session, response);
        storeToken(nextSession.token);
        resetCurrentSession();
        this.#session = nextSession;
        this.render();
        await this.#emitSessionChange(nextSession, response);
        this.#showToast(response.message || 'Perfil atualizado.', 'success', DASHBOARD_ACTION_TOAST_GROUP);
    }

    /**
     * Submits the authenticated password change flow.
     */
    async #handlePasswordSubmit(values, form) {
        const currentPassword = readText(values?.currentPassword, '');
        const newPassword = readText(values?.newPassword, '');
        const confirmPassword = readText(values?.confirmPassword, '');

        if (!currentPassword || !newPassword || !confirmPassword) {
            this.#showToast('Informe a senha atual, a nova senha e a confirmação.', 'error', DASHBOARD_ACTION_TOAST_GROUP);
            form.getField(
                !currentPassword
                    ? 'dashboard-settings-current-password'
                    : (!newPassword ? 'dashboard-settings-new-password' : 'dashboard-settings-confirm-password')
            )?.focus();
            return;
        }

        if (newPassword === currentPassword) {
            this.#showToast('A nova senha precisa ser diferente da senha atual.', 'error', DASHBOARD_ACTION_TOAST_GROUP);
            form.getField('dashboard-settings-new-password')?.focus();
            return;
        }

        if (newPassword !== confirmPassword) {
            this.#showToast('A confirmação da nova senha não confere.', 'error', DASHBOARD_ACTION_TOAST_GROUP);
            form.getField('dashboard-settings-confirm-password')?.focus();
            return;
        }

        if (!this.#readSessionToken()) {
            this.#showToast('Não foi possível validar a sua sessão agora.', 'error', DASHBOARD_ACTION_TOAST_GROUP);
            return;
        }

        const response = await requestApi('/auth/password', {
            method: 'PUT',
            token: this.#readSessionToken(),
            body: { currentPassword, newPassword },
        });

        if (!response.ok) {
            this.#showToast(response.message || 'Não foi possível atualizar a senha agora.', 'error', DASHBOARD_ACTION_TOAST_GROUP);
            return;
        }

        form.reset();
        this.#showToast(response.message || 'Senha atualizada.', 'success', DASHBOARD_ACTION_TOAST_GROUP);
    }

    /**
     * Submits the authenticated e-mail preference update flow.
     */
    async #handlePreferencesSubmit(form) {
        if (!this.#readSessionToken()) {
            this.#showToast('Não foi possível validar a sua sessão agora.', 'error', DASHBOARD_ACTION_TOAST_GROUP);
            return;
        }

        const emailPreferences = {
            eventUpdates: Boolean(form.getField('dashboard-settings-email-event-updates')?.getValue()),
        };

        if (this.#isAdmin()) {
            emailPreferences.adminPendingRequests = Boolean(form.getField('dashboard-settings-email-admin-pending')?.getValue());
        }

        const response = await requestApi('/auth/me/preferences', {
            method: 'PUT',
            token: this.#readSessionToken(),
            body: {
                emailPreferences,
            },
        });

        if (!response.ok) {
            this.#showToast(response.message || 'Não foi possível atualizar as preferências agora.', 'error', DASHBOARD_ACTION_TOAST_GROUP);
            return;
        }

        if (!response.data?.user) {
            this.#showToast('A resposta do servidor não trouxe as preferências atualizadas.', 'error', DASHBOARD_ACTION_TOAST_GROUP);
            return;
        }

        const nextSession = createUpdatedSession(this.#session, response);
        storeToken(nextSession.token);
        resetCurrentSession();
        this.#session = nextSession;
        this.render();
        await this.#emitSessionChange(nextSession, response);
        this.#showToast(response.message || 'Preferências de e-mail atualizadas.', 'success', DASHBOARD_ACTION_TOAST_GROUP);
    }

    /**
     * Submits the administrator password-reset flow keyed by e-mail.
     */
    async #handleAdminResetSubmit(values, form) {
        const email = normalizeEmail(values?.email);
        const newPassword = readText(values?.newPassword, '');

        if (!this.#isAdmin()) {
            this.#showToast('Apenas administradores podem redefinir senhas por aqui.', 'error', DASHBOARD_ACTION_TOAST_GROUP);
            return;
        }

        if (!email || !newPassword) {
            this.#showToast('Informe o e-mail do usuário e a nova senha.', 'error', DASHBOARD_ACTION_TOAST_GROUP);
            form.getField(
                !email
                    ? 'dashboard-settings-admin-reset-email'
                    : 'dashboard-settings-admin-reset-password'
            )?.focus();
            return;
        }

        if (!this.#readSessionToken()) {
            this.#showToast('Não foi possível validar a sua sessão agora.', 'error', DASHBOARD_ACTION_TOAST_GROUP);
            return;
        }

        const response = await requestApi('/users/password/reset', {
            method: 'PUT',
            token: this.#readSessionToken(),
            body: { email, newPassword },
        });

        if (!response.ok) {
            this.#showToast(response.message || 'Não foi possível redefinir a senha agora.', 'error', DASHBOARD_ACTION_TOAST_GROUP);
            return;
        }

        form.reset();
        this.#showToast(response.message || 'Senha do usuário atualizada.', 'success', DASHBOARD_ACTION_TOAST_GROUP);
    }

    /**
     * Submits the administrator promote-to-admin flow keyed by e-mail.
     */
    async #handleAdminPromoteSubmit(values, form) {
        const email = normalizeEmail(values?.email);

        if (!this.#isAdmin()) {
            this.#showToast('Apenas administradores podem promover novas contas.', 'error', DASHBOARD_ACTION_TOAST_GROUP);
            return;
        }

        if (!email) {
            this.#showToast('Informe o e-mail do usuário que deve ser promovido.', 'error', DASHBOARD_ACTION_TOAST_GROUP);
            form.getField('dashboard-settings-admin-promote-email')?.focus();
            return;
        }

        if (!this.#readSessionToken()) {
            this.#showToast('Não foi possível validar a sua sessão agora.', 'error', DASHBOARD_ACTION_TOAST_GROUP);
            return;
        }

        const lookup = await this.#findUserByEmail(email);

        if (!lookup.ok) {
            this.#showToast(lookup.message || 'Não foi possível consultar os usuários agora.', 'error', DASHBOARD_ACTION_TOAST_GROUP);
            return;
        }

        if (!lookup.user) {
            this.#showToast('Nenhum usuário correspondente ao e-mail informado foi encontrado.', 'error', DASHBOARD_ACTION_TOAST_GROUP);
            return;
        }

        if (isAdminRole(lookup.user.role)) {
            this.#showToast('Este usuário já é administrador.', 'error', DASHBOARD_ACTION_TOAST_GROUP);
            return;
        }

        const response = await requestApi(`/users/${lookup.user.id}/promote`, {
            method: 'PUT',
            token: this.#readSessionToken(),
        });

        if (!response.ok) {
            this.#showToast(response.message || 'Não foi possível promover o usuário agora.', 'error', DASHBOARD_ACTION_TOAST_GROUP);
            return;
        }

        form.reset();
        this.#showToast(response.message || 'Usuário promovido a administrador.', 'success', DASHBOARD_ACTION_TOAST_GROUP);
    }

    /**
     * Triggers the weekly digest immediately from the administrator settings tools.
     */
    async #handleManualDigestTrigger() {
        if (!this.#isAdmin()) {
            this.#showToast('Apenas administradores podem enviar o resumo semanal manualmente.', 'error', DASHBOARD_ACTION_TOAST_GROUP);
            return;
        }

        if (!this.#readSessionToken()) {
            this.#showToast('Não foi possível validar a sua sessão agora.', 'error', DASHBOARD_ACTION_TOAST_GROUP);
            return;
        }

        const response = await requestApi('/auth/weekly-digest/send', {
            method: 'POST',
            token: this.#readSessionToken(),
            body: {
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
        });

        if (!response.ok) {
            this.#showToast(response.message || 'Não foi possível enviar o resumo semanal agora.', 'error', DASHBOARD_ACTION_TOAST_GROUP);
            return;
        }

        this.render();
        this.#showToast(response.message || 'Agenda semanal enviada com sucesso.', 'success', DASHBOARD_ACTION_TOAST_GROUP);
    }

    /**
     * Resolves one user record by e-mail through the admin listing endpoint.
     */
    async #findUserByEmail(email) {
        const currentUser = this.#readCurrentUserMatch(email);
        if (currentUser) {
            return {
                ok: true,
                user: currentUser,
                message: null,
            };
        }

        const response = await requestApi('/users', {
            token: this.#readSessionToken(),
        });

        if (!response.ok) {
            return {
                ok: false,
                user: null,
                message: response.message,
            };
        }

        const users = Array.isArray(response.data?.users)
            ? response.data.users
            : [];
        const user = users.find(currentUser => normalizeEmail(currentUser?.email) === email) || null;

        return {
            ok: true,
            user,
            message: null,
        };
    }

    /**
     * Returns the authenticated session user when the submitted e-mail matches it.
     */
    #readCurrentUserMatch(email) {
        const currentUser = this.#session?.user;

        if (!currentUser || normalizeEmail(currentUser.email) !== email) {
            return null;
        }

        return currentUser;
    }

    /**
     * Keeps the profile form fields aligned with the last known session payload.
     */
    #syncProfileFields() {
        const profileKey = JSON.stringify({
            name: readText(this.#session?.user?.name, ''),
            email: readText(this.#session?.user?.email, ''),
            role: readText(this.#session?.user?.role, ''),
        });

        if (profileKey === this.#renderedProfileKey) {
            return;
        }

        this.#renderedProfileKey = profileKey;
        this.#forms.profile.getField('dashboard-settings-name')?.setValue(this.#session?.user?.name || '');
        this.#forms.profile.getField('dashboard-settings-email')?.setValue(this.#session?.user?.email || '');
    }

    /**
     * Keeps the preference checkboxes aligned with the last known session payload.
     */
    #syncPreferenceFields() {
        const emailPreferences = this.#session?.user?.emailPreferences || {};
        const preferenceKey = JSON.stringify({
            ...emailPreferences,
            isAdmin: this.#isAdmin(),
        });

        if (preferenceKey === this.#renderedPreferenceKey) {
            return;
        }

        this.#renderedPreferenceKey = preferenceKey;
        this.#forms.preferences.getField('dashboard-settings-email-event-updates')?.setValue(emailPreferences.eventUpdates ?? true);
        this.#forms.preferences.getField('dashboard-settings-email-admin-pending')?.setValue(
            this.#isAdmin()
                ? (emailPreferences.adminPendingRequests ?? true)
                : false
        );
    }

    /**
     * Focuses one settings panel and updates the local navigation state.
     */
    #focusPanel(panelName) {
        const normalizedPanel = readText(panelName, 'profile').toLowerCase();
        const panel = normalizedPanel === 'password'
            ? this.#elements.passwordPanel
            : (normalizedPanel === 'emails'
                ? this.#elements.preferencesPanel
                : (normalizedPanel === 'admin' ? this.#elements.adminPanel : this.#elements.profilePanel));

        if (!panel) {
            return;
        }

        this.#updateNavigationState(normalizedPanel);
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        panel.focus({ preventScroll: true });
    }

    /**
     * Marks one settings shortcut button as the current anchor target.
     */
    #updateNavigationState(panelName) {
        this.#elements.navButtons.forEach((button) => {
            const isCurrent = readText(button.dataset.dashboardSettingsAnchor, '') === panelName;
            button.setAttribute('aria-current', isCurrent ? 'true' : 'false');
        });
    }

    /**
     * Returns the active authenticated session token.
     */
    #readSessionToken() {
        return readText(this.#session?.token, '');
    }

    /**
     * Reports whether the active session belongs to an administrator.
     */
    #isAdmin() {
        return isAdminRole(this.#session?.user?.role);
    }

    /**
     * Emits the session-change callbacks registered by the dashboard shell.
     */
    async #emitSessionChange(session, response) {
        for (const handler of this.#sessionChangeHandlers) {
            await handler({ session, response });
        }
    }

    /**
     * Emits one shared toast for settings actions.
     */
    #showToast(text, tone = 'info', group = DASHBOARD_SETTINGS_TOAST_GROUP) {
        const normalizedText = readText(text, '');
        if (!normalizedText) {
            return null;
        }

        Toast.dismissGroup(group);
        return Toast.show(normalizedText, {
            tone,
            group,
            duration: tone === 'success' ? 4400 : 6000,
        });
    }
}

export default DashboardSettingsPanels;
