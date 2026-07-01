import { authApi } from '../model/auth.js';

let currentSessionPromise = null;

/**
 * Resolves the current authenticated session from local storage and the API.
 */
async function resolveCurrentSession() {
    const token = authApi.readToken();
    if (!token) {
        return {
            isAuthenticated: false,
            token: null,
            user: null,
            status: 401,
            reason: 'missing-token',
            message: null,
        };
    }

    const response = await authApi.current(token);
    if (response.ok && response.data?.user) {
        return {
            isAuthenticated: true,
            token,
            user: response.data.user,
            status: response.status,
            reason: 'authenticated',
            message: null,
        };
    }

    if (response.status === 401 || response.status === 403) {
        authApi.clearToken();
        return {
            isAuthenticated: false,
            token: null,
            user: null,
            status: response.status,
            reason: 'invalid-token',
            message: response.message || 'Sua sessão expirou.',
        };
    }

    return {
        isAuthenticated: false,
        token,
        user: null,
        status: response.status,
        reason: 'request-failed',
        message: response.message || 'Não foi possível validar a sessão.',
    };
}

/**
 * Clears the cached session lookup used by the current page.
 */
export function resetCurrentSession() {
    currentSessionPromise = null;
}

/**
 * Returns the current authenticated session, caching the in-flight lookup per page load.
 */
export function getCurrentSession({ forceRefresh = false } = {}) {
    if (forceRefresh) {
        resetCurrentSession();
    }

    if (!currentSessionPromise) {
        currentSessionPromise = resolveCurrentSession();
    }

    return currentSessionPromise;
}
