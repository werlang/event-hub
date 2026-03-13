import { HeaderSessionNav } from '../components/header-session-nav.js';
import { clearToken, readToken, requestApi } from './api.js';

let currentSessionPromise = null;

/**
 * Reads the current browser path as the default post-auth redirect target.
 */
function readCurrentLocationTarget() {
    return `${window.location.pathname}${window.location.search}`;
}

/**
 * Normalizes an internal redirect target and blocks unsafe or looping values.
 */
export function normalizeRedirectTarget(target = readCurrentLocationTarget()) {
    if (typeof target !== 'string' || !target.startsWith('/')) {
        return '/';
    }

    if (target.startsWith('//') || target.startsWith('/login')) {
        return '/';
    }

    return target;
}

/**
 * Builds the login URL used by auth-aware navigation controls.
 */
export function createLoginHref(target = readCurrentLocationTarget()) {
    const redirectTarget = normalizeRedirectTarget(target);
    if (redirectTarget === '/') {
        return '/login';
    }

    const params = new URLSearchParams({ redirect: redirectTarget });
    return `/login?${params.toString()}`;
}

/**
 * Resolves the current authenticated session from local storage and the API.
 */
async function resolveCurrentSession() {
    const token = readToken();
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

    const response = await requestApi('/auth/me', { token });
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
        clearToken();
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

/**
 * Synchronizes the shared header call-to-action with the current session state.
 */
export async function syncHeaderSessionNavigation({ redirectTarget, isDashboardPage = false } = {}) {
    const headerNav = HeaderSessionNav.fromDocument();
    if (headerNav.isReady()) {
        headerNav.setChecking();
    }

    const session = await getCurrentSession();
    if (!headerNav.isReady()) {
        return { headerNav, session };
    }

    if (session.isAuthenticated) {
        headerNav.setAuthenticated({
            name: session.user?.name,
            isCurrentPage: isDashboardPage,
        });

        return { headerNav, session };
    }

    headerNav.setAnonymous({ loginHref: createLoginHref(redirectTarget) });
    return { headerNav, session };
}