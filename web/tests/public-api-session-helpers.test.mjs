import assert from 'node:assert/strict';
import test from 'node:test';

import {
    ApiClient,
    TOKEN_STORAGE_KEY,
    appendTimeZoneHeader,
    apiClient,
    clearToken,
    readToken,
    storeToken,
} from '../src/js/helpers/api.js';
import { getCurrentSession, resetCurrentSession } from '../src/js/helpers/session.js';

/**
 * Restores one global property to the previous descriptor captured by a test helper.
 */
function restoreGlobalProperty(propertyName, previousDescriptor) {
    if (previousDescriptor) {
        Object.defineProperty(globalThis, propertyName, previousDescriptor);
        return;
    }

    delete globalThis[propertyName];
}

/**
 * Installs one mutable localStorage double for auth helper tests.
 */
function installStorage(initialState = {}) {
    const previousDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const values = new Map(Object.entries(initialState));
    const operations = [];

    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        writable: true,
        value: {
            getItem(key) {
                operations.push({ type: 'get', key });
                return values.has(key) ? values.get(key) : null;
            },

            setItem(key, value) {
                operations.push({ type: 'set', key, value: String(value) });
                values.set(key, String(value));
            },

            removeItem(key) {
                operations.push({ type: 'remove', key });
                values.delete(key);
            },

            clear() {
                operations.push({ type: 'clear' });
                values.clear();
            },
        },
    });

    return {
        operations,
        values,
        restore() {
            restoreGlobalProperty('localStorage', previousDescriptor);
        },
    };
}

/**
 * Installs one unreadable localStorage accessor to prove storage helpers fail safely.
 */
function installThrowingStorage() {
    const previousDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        get() {
            throw new Error('Storage blocked');
        },
    });

    return () => {
        restoreGlobalProperty('localStorage', previousDescriptor);
    };
}

/**
 * Replaces the shared apiClient request function for one test and restores it afterwards.
 */
function stubSharedApiRequest(requestImplementation) {
    const originalRequest = apiClient.request;
    apiClient.request = requestImplementation;

    return () => {
        apiClient.request = originalRequest;
    };
}

test('ApiClient keeps enveloped API errors intact for public auth screens', async () => {
    const recordedCalls = [];
    const client = new ApiClient({
        endpointResolver: {
            resolve(path) {
                return `https://api.example${path.startsWith('/') ? path : `/${path}`}`;
            },
        },
        request: {
            async post(endpoint, body, options) {
                recordedCalls.push({ endpoint, body, options });
                const error = new Error('HTTP 401');
                error.status = 401;
                error.data = {
                    error: true,
                    status: 401,
                    type: 'AuthError',
                    message: 'Credenciais inválidas.',
                    data: {
                        field: 'password',
                    },
                };
                throw error;
            },
        },
    });

    const response = await client.request('auth/login', {
        method: 'post',
        body: {
            email: 'membro@ifsul.edu.br',
            password: 'senha-segura',
        },
    });

    assert.deepEqual(recordedCalls, [{
        endpoint: 'https://api.example/auth/login',
        body: {
            email: 'membro@ifsul.edu.br',
            password: 'senha-segura',
        },
        options: {
            headers: {
                Accept: 'application/json',
            },
        },
    }]);
    assert.equal(response.ok, false);
    assert.equal(response.status, 401);
    assert.equal(response.message, 'Credenciais inválidas.');
    assert.equal(response.type, 'AuthError');
    assert.deepEqual(response.data, { field: 'password' });
});

test('ApiClient converts timeout failures into the shared public network-error shape', async () => {
    const client = new ApiClient({
        endpointResolver: {
            resolve(path) {
                return path;
            },
        },
        request: {
            async get() {
                throw new Error('Request timeout');
            },
        },
    });

    const response = await client.request('/events');

    assert.deepEqual(response, {
        ok: false,
        status: 0,
        data: null,
        message: 'Não foi possível conectar ao servidor.',
        type: 'NetworkError',
        raw: response.raw,
    });
    assert.equal(response.raw.message, 'Request timeout');
});

test('appendEventRequestTimeZoneHeader adds the browser timezone only for event requests', () => {
    const expectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    assert.deepEqual(appendTimeZoneHeader('/events?from=2026-05-17&to=2026-05-23'), {
        Timezone: expectedTimezone,
    });
    assert.deepEqual(appendTimeZoneHeader('/events', { Timezone: 'America/Manaus' }), {
        Timezone: 'America/Manaus',
    });
    assert.deepEqual(appendTimeZoneHeader('/auth/me'), {});
});

test('ApiClient appends the browser timezone header to event requests before dispatch', async () => {
    const expectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const recordedCalls = [];
    const client = new ApiClient({
        endpointResolver: {
            resolve(path) {
                return `https://api.example${path.startsWith('/') ? path : `/${path}`}`;
            },
        },
        request: {
            async get(endpoint, options) {
                recordedCalls.push({ endpoint, options });
                return { error: false, status: 200, data: { events: [] } };
            },
        },
    });

    const response = await client.request('/events?from=2026-05-17&to=2026-05-23');

    assert.equal(recordedCalls[0].endpoint, 'https://api.example/events?from=2026-05-17&to=2026-05-23');
    assert.deepEqual(recordedCalls[0].options, {
        headers: {
            Accept: 'application/json',
            Timezone: expectedTimezone,
        },
    });
    assert.equal(response.ok, true);
    assert.deepEqual(response.data, { events: [] });
});

test('token helpers trim persisted values and clear them cleanly', () => {
    const storage = installStorage();

    try {
        storeToken('  jwt-public-token  ');
        assert.equal(readToken(), 'jwt-public-token');
        assert.deepEqual(storage.operations.slice(0, 2), [
            { type: 'set', key: TOKEN_STORAGE_KEY, value: 'jwt-public-token' },
            { type: 'get', key: TOKEN_STORAGE_KEY },
        ]);

        clearToken();
        assert.equal(readToken(), null);
    } finally {
        storage.restore();
    }
});

test('token helpers tolerate unreadable localStorage', () => {
    const restore = installThrowingStorage();

    try {
        assert.doesNotThrow(() => {
            storeToken('jwt-ignored');
        });
        assert.equal(readToken(), null);
        assert.doesNotThrow(() => {
            clearToken();
        });
    } finally {
        restore();
    }
});

test('getCurrentSession returns the missing-token state without contacting the API', async () => {
    const storage = installStorage();
    const restoreRequest = stubSharedApiRequest(async () => {
        throw new Error('requestApi should not be called without a stored token.');
    });

    try {
        resetCurrentSession();
        const session = await getCurrentSession({ forceRefresh: true });

        assert.deepEqual(session, {
            isAuthenticated: false,
            token: null,
            user: null,
            status: 401,
            reason: 'missing-token',
            message: null,
        });
    } finally {
        resetCurrentSession();
        restoreRequest();
        storage.restore();
    }
});

test('getCurrentSession caches one authenticated lookup and preserves the stored token', async () => {
    const storage = installStorage({
        [TOKEN_STORAGE_KEY]: 'member-token',
    });
    const authenticatedUser = {
        id: 'user-1',
        name: 'Membro IFSul',
        role: 'member',
    };
    let callCount = 0;
    const restoreRequest = stubSharedApiRequest(async (path, options) => {
        callCount += 1;
        assert.equal(path, '/auth/me');
        assert.deepEqual(options, {
            token: 'member-token',
        });

        return {
            ok: true,
            status: 200,
            data: {
                user: authenticatedUser,
            },
        };
    });

    try {
        resetCurrentSession();
        const firstLookup = getCurrentSession({ forceRefresh: true });
        const secondLookup = getCurrentSession();
        const [firstSession, secondSession] = await Promise.all([firstLookup, secondLookup]);

        assert.equal(callCount, 1);
        assert.deepEqual(firstSession, {
            isAuthenticated: true,
            token: 'member-token',
            user: authenticatedUser,
            status: 200,
            reason: 'authenticated',
            message: null,
        });
        assert.deepEqual(secondSession, firstSession);
        assert.equal(readToken(), 'member-token');
        assert.deepEqual(storage.operations.filter((operation) => operation.type === 'remove'), []);
    } finally {
        resetCurrentSession();
        restoreRequest();
        storage.restore();
    }
});

test('getCurrentSession caches one invalid-token lookup and clears the stored token', async () => {
    const storage = installStorage({
        [TOKEN_STORAGE_KEY]: 'expired-token',
    });
    let callCount = 0;
    const restoreRequest = stubSharedApiRequest(async () => {
        callCount += 1;
        return {
            ok: false,
            status: 401,
            message: 'Sua sessão expirou.',
        };
    });

    try {
        resetCurrentSession();
        const firstLookup = getCurrentSession({ forceRefresh: true });
        const secondLookup = getCurrentSession();
        const [firstSession, secondSession] = await Promise.all([firstLookup, secondLookup]);

        assert.equal(callCount, 1);
        assert.deepEqual(firstSession, {
            isAuthenticated: false,
            token: null,
            user: null,
            status: 401,
            reason: 'invalid-token',
            message: 'Sua sessão expirou.',
        });
        assert.deepEqual(secondSession, firstSession);
        assert.equal(readToken(), null);
        assert.deepEqual(storage.operations.filter((operation) => operation.type === 'remove'), [{
            type: 'remove',
            key: TOKEN_STORAGE_KEY,
        }]);
    } finally {
        resetCurrentSession();
        restoreRequest();
        storage.restore();
    }
});

test('getCurrentSession preserves the stored token on non-auth request failures', async () => {
    const storage = installStorage({
        [TOKEN_STORAGE_KEY]: 'member-token',
    });
    const restoreRequest = stubSharedApiRequest(async () => {
        return {
            ok: false,
            status: 503,
            message: 'Servidor temporariamente indisponível.',
        };
    });

    try {
        resetCurrentSession();
        const session = await getCurrentSession({ forceRefresh: true });

        assert.deepEqual(session, {
            isAuthenticated: false,
            token: 'member-token',
            user: null,
            status: 503,
            reason: 'request-failed',
            message: 'Servidor temporariamente indisponível.',
        });
        assert.equal(readToken(), 'member-token');
    } finally {
        resetCurrentSession();
        restoreRequest();
        storage.restore();
    }
});