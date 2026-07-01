import { apiClient, authTokenStore } from '../helpers/api.js';

/**
 * Encapsulates authenticated account API calls used by browser code.
 */
export class AuthApi {
    #client;
    #tokenStore;

    /**
     * Creates an auth API facade backed by the shared client and token store.
     */
    constructor({ client = apiClient, tokenStore = authTokenStore } = {}) {
        this.#client = client;
        this.#tokenStore = tokenStore;
    }

    /**
     * Submits login credentials.
     */
    login(credentials) {
        return this.#client.request('/auth/login', {
            method: 'POST',
            body: credentials,
        });
    }

    /**
     * Creates a new member account.
     */
    register(payload) {
        return this.#client.request('/auth/register', {
            method: 'POST',
            body: payload,
        });
    }

    /**
     * Loads the current authenticated profile.
     */
    current(token) {
        return this.#client.request('/auth/me', { token });
    }

    /**
     * Updates the current authenticated profile.
     */
    updateProfile(token, payload) {
        return this.#client.request('/auth/me', {
            method: 'PUT',
            token,
            body: payload,
        });
    }

    /**
     * Changes the current authenticated password.
     */
    changePassword(token, payload) {
        return this.#client.request('/auth/password', {
            method: 'PUT',
            token,
            body: payload,
        });
    }

    /**
     * Updates current e-mail notification preferences.
     */
    updatePreferences(token, emailPreferences) {
        return this.#client.request('/auth/me/preferences', {
            method: 'PUT',
            token,
            body: { emailPreferences },
        });
    }

    /**
     * Triggers the weekly digest immediately for administrators.
     */
    sendWeeklyDigest(token, payload) {
        return this.#client.request('/auth/weekly-digest/send', {
            method: 'POST',
            token,
            body: payload,
        });
    }

    /**
     * Reads the stored bearer token.
     */
    readToken() {
        return this.#tokenStore.read();
    }

    /**
     * Persists a bearer token.
     */
    storeToken(token) {
        this.#tokenStore.store(token);
    }

    /**
     * Clears the stored bearer token.
     */
    clearToken() {
        this.#tokenStore.clear();
    }
}

export const authApi = new AuthApi();

