import { Modal } from '../components/modal.js';
import { Toast } from '../components/toast.js';

const SETTINGS_MODAL_FILE = '/html/dashboard-settings-modal.html';
const DASHBOARD_STATUS_TOAST_GROUP = 'dashboard-status';

/**
 * Returns a localized label for the authenticated account role.
 */
function readRoleLabel(role) {
    return String(role || '').trim().toLowerCase() === 'admin'
        ? 'Administrador'
        : 'Membro';
}

/**
 * Returns a safe user-facing text fallback.
 */
function readText(value, fallback) {
    const normalizedValue = typeof value === 'string' ? value.trim() : '';
    return normalizedValue || fallback;
}

export class DashboardSettingsModal {
    #modal;
    #preloadPromise = null;
    #trigger = null;
    #triggerClickHandler = () => {
        void this.open().catch(() => {
            this.#showToast('Não foi possível abrir as configurações agora.', 'error');
        });
    };
    #user = null;

    /**
     * Creates the reusable dashboard modal reserved for account settings.
     */
    constructor({ trigger = null } = {}) {
        this.#modal = new Modal({
            id: 'dashboard-settings-modal',
            eyebrow: 'Configurações',
            title: 'Preferências da conta',
            description: 'Esta área ainda está em preparação, mas já tem um lugar próprio dentro do dashboard.',
        });

        this.#modal.addAction({
            id: 'dashboard-settings-close',
            label: 'Entendi',
            icon: 'check',
            tone: 'primary',
            closeOnClick: true,
            autofocus: true,
        });

        this.bindTrigger(trigger);
        this.#preloadPromise = this.preload().catch(() => null);
    }

    /**
     * Binds the element responsible for opening the settings modal.
     */
    bindTrigger(trigger) {
        if (this.#trigger) {
            this.#trigger.removeEventListener('click', this.#triggerClickHandler);
        }

        this.#trigger = trigger || null;
        this.#trigger?.addEventListener('click', this.#triggerClickHandler);
        return this;
    }

    /**
     * Stores the current authenticated user for template rendering.
     */
    setUser(user = null) {
        this.#user = user && typeof user === 'object' ? user : null;
        return this;
    }

    /**
     * Preloads the settings template into the shared modal cache.
     */
    async preload() {
        await this.#modal.preloadContentFromFile(SETTINGS_MODAL_FILE);
        return this;
    }

    /**
     * Loads the settings body with template args derived from the current user and opens the modal.
     */
    async open({ args = {} } = {}) {
        await this.#modal.loadContentFromFile(SETTINGS_MODAL_FILE, {
            args: {
                ...this.#readTemplateArgs(),
                ...args,
            },
        });
        this.#modal.open();
        return this;
    }

    /**
     * Destroys the settings modal instance.
     */
    destroy() {
        if (this.#trigger) {
            this.#trigger.removeEventListener('click', this.#triggerClickHandler);
        }

        this.#modal.destroy();
        return this;
    }

    /**
     * Builds the template arguments used by the settings modal fragment.
     */
    #readTemplateArgs() {
        const accountName = readText(this.#user?.name, 'usuário');
        const roleLabel = readRoleLabel(this.#user?.role).toLowerCase();

        return {
            accountName,
            intro: `Esta área foi reservada para a próxima etapa do dashboard, ${accountName}, e vai concentrar as preferências da sua conta.`,
            roleLabel,
        };
    }

    /**
     * Emits a shared toast for settings-modal failures.
     */
    #showToast(text, tone = 'info') {
        const normalizedText = readText(text, '');
        if (!normalizedText) {
            return null;
        }

        return Toast.show(normalizedText, {
            tone,
            group: DASHBOARD_STATUS_TOAST_GROUP,
            duration: tone === 'success' ? 4400 : 6000,
        });
    }
}

export default DashboardSettingsModal;