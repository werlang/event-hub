import { getCurrentSession } from '../helpers/session.js';
import { clearToken } from '../helpers/api.js';
import { Toast } from './toast.js';

/**
 * Builds the initials shown by the authenticated header action.
 */
function readUserInitials(name) {
    const normalizedName = typeof name === 'string' ? name.trim() : '';

    if (!normalizedName) {
        return 'U';
    }

    const initials = normalizedName
        .split(/\s+/)
        .map(part => part[0])
        .filter((character, index, characters) => index === 0 || index === characters.length - 1)
        .join('')
        .toUpperCase();

    return initials || 'U';
}

/**
 * Header component, responsible for rendering the header and managing the login/logout buttons.
 */
export class Header {

    #enforceAuth;
    #session;
    #logoutHandler = (event) => {
        event.preventDefault();
        clearToken();
        Toast.flash('Sessão encerrada.', {
            tone: 'info',
            group: 'auth-redirect',
        });
        window.location.href = '/';
    };

    #LOGIN_REDIRECT_REASONS = new Set(['missing-token', 'invalid-token']);

    constructor(enforceAuth) {
        this.#enforceAuth = enforceAuth || false;

        Toast.consumeFlash();
        this.#resolveSession();
    }

    /**
     * Resolves the current session and updates the header UI accordingly. If enforceAuth is true, will redirect to login if not authenticated.
     */
    async #resolveSession() {
       this.#session = await this.getSession();

        if (this.#enforceAuth && !this.#session.isAuthenticated && this.#LOGIN_REDIRECT_REASONS.has(this.#session.reason)) {
            Toast.flash(
                this.#session.message || 'Faça login para continuar.',
                {
                    tone: this.#session.reason === 'invalid-token' ? 'warning' : 'info',
                    group: 'auth-redirect',
                },
            );
            const target = `${window.location.pathname}${window.location.search}${window.location.hash}`;
            const url = `/login?redirect=${encodeURIComponent(target)}`;
            window.location.href = url;
        }

        if (!this.#session.isAuthenticated) {
            return this;
        }

        this.#applyAuthenticatedSession();
        return this;
    }

    /**
     * Applies a known authenticated session to the header without re-fetching it.
     */
    setSession(session) {
        this.#session = session && typeof session === 'object'
            ? session
            : null;

        if (this.#session?.isAuthenticated) {
            this.#applyAuthenticatedSession();
        }

        return this;
    }

    /**
     * Returns the current session, resolving it first if not already done.
     */
    async getSession() {
        if (!this.#session) {
            this.#session = await getCurrentSession();
        }
        return this.#session;
    }

    /**
     * Synchronizes the header controls with the active authenticated session.
     */
    #applyAuthenticatedSession() {
        const loginButton = document.querySelector('#header-login-link');
        const logoutButton = document.querySelector('#header-logout-link');

        if (!(loginButton instanceof HTMLAnchorElement) || !(logoutButton instanceof HTMLAnchorElement)) {
            return this;
        }

        loginButton.classList.add('logged');
        loginButton.href = '/dashboard';
        loginButton.textContent = readUserInitials(this.#session?.user?.name);

        logoutButton.classList.add('active');
        logoutButton.removeEventListener('click', this.#logoutHandler);
        logoutButton.addEventListener('click', this.#logoutHandler);
        return this;
    }

}