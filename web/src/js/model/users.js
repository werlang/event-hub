import { apiClient } from '../helpers/api.js';

/**
 * Encapsulates user-management and password-reset API calls.
 */
export class UserApi {
    #client;

    /**
     * Creates a user API facade backed by the shared API client.
     */
    constructor({ client = apiClient } = {}) {
        this.#client = client;
    }

    /**
     * Requests a self-service password reset e-mail.
     */
    requestPasswordReset(email) {
        return this.#client.request('/users/password-reset', {
            method: 'POST',
            body: { email },
        });
    }

    /**
     * Confirms a self-service password reset token.
     */
    confirmPasswordReset({ token, newPassword } = {}) {
        return this.#client.request('/users/password-reset', {
            method: 'PUT',
            body: {
                token,
                newPassword,
            },
        });
    }

    /**
     * Lists users for administrator tools.
     */
    list(token) {
        return this.#client.request('/users', { token });
    }

    /**
     * Resets a member password from the administrator dashboard.
     */
    adminResetPassword(token, payload) {
        return this.#client.request('/users/password/reset', {
            method: 'PUT',
            token,
            body: payload,
        });
    }

    /**
     * Promotes one user to administrator.
     */
    promote(token, userId) {
        return this.#client.request(`/users/${encodeURIComponent(String(userId || ''))}/promote`, {
            method: 'PUT',
            token,
        });
    }
}

export const userApi = new UserApi();

