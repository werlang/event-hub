import { getCurrentSession } from '../helpers/session.js';
import { clearToken } from '../helpers/api.js';
import { Toast } from './toast.js';

/**
 * Header component, responsible for rendering the header and managing the login/logout buttons.
 */
export class Header {

    #enforceAuth;
    #session;

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

        const loginButton = document.querySelector('#header-login-link');
        const logoutButton = document.querySelector('#header-logout-link');

        loginButton.classList.add('logged');
        const userName = this.#session.user?.name;
        const initials = userName ? userName.split(' ').map((n) => n[0]).filter((c, i, a) => i === 0 || i === a.length - 1).join('').toUpperCase() : 'U';
        loginButton.href = '/dashboard';
        loginButton.textContent = initials;

        logoutButton.classList.add('active');
        logoutButton.addEventListener('click', (event) => {
            event.preventDefault();
            // remove auth token and send user to login page
            clearToken();
            Toast.flash('Sessão encerrada.', {
                tone: 'info',
                group: 'auth-redirect',
            });
            window.location.href = '/';
        });

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

}