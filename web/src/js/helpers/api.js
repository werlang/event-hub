import { TemplateVar } from './template-var.js';
import { Request } from './request.js';

export const TOKEN_STORAGE_KEY = 'auth_token';

class ApiEndpointResolver {
    /**
     * Removes a trailing slash from an API base URL.
     */
    #sanitizeBaseUrl(url) {
        if (!url || typeof url !== 'string') {
            return '';
        }

        return url.replace(/\/$/, '');
    }

    /**
     * Resolves the API base URL from template vars, meta tags, or fallback state.
     */
    #resolveApiUrl() {
        const fromTemplate = TemplateVar.get('apiUrl');
        if (fromTemplate) {
            return this.#sanitizeBaseUrl(fromTemplate);
        }

        const fromMeta = document.querySelector('meta[name="api-url"]')?.getAttribute('content');
        if (fromMeta) {
            return this.#sanitizeBaseUrl(fromMeta);
        }

        return '';
    }

    /**
     * Normalizes a request path into an absolute API path.
     */
    #toAbsolutePath(path) {
        if (typeof path !== 'string' || !path) {
            return '/';
        }

        return path.startsWith('/') ? path : `/${path}`;
    }

    /**
     * Combines the resolved API base URL and the requested path.
     */
    resolve(path) {
        return `${this.#resolveApiUrl()}${this.#toAbsolutePath(path)}`;
    }
}

/**
 * Normalizes API responses into the frontend envelope expected by the UI.
 */
function normalizeEnvelope(response, payload) {
    if (payload && typeof payload === 'object' && typeof payload.error === 'boolean') {
        return {
            ok: !payload.error && response.ok,
            status: Number.isInteger(payload.status) ? payload.status : response.status,
            data: payload.data,
            message: payload.message || null,
            type: payload.type || null,
            raw: payload,
        };
    }

    return {
        ok: response.ok,
        status: response.status,
        data: payload,
        message: null,
        type: null,
        raw: payload,
    };
}

/**
 * Returns the browser storage object when it is available and readable.
 */
function getStorage() {
    try {
        return globalThis.localStorage || null;
    } catch {
        return null;
    }
}

/**
 * Runs one storage operation without breaking pages where storage is unavailable.
 */
function runStorageOperation(callback, fallbackValue = null) {
    const storage = getStorage();
    if (!storage || typeof callback !== 'function') {
        return fallbackValue;
    }

    try {
        return callback(storage);
    } catch {
        return fallbackValue;
    }
}

class AuthTokenStore {
    #storageKey = TOKEN_STORAGE_KEY;

    /**
     * Reads the stored authentication token from localStorage.
     */
    read() {
        return runStorageOperation(storage => storage.getItem(this.#storageKey), null);
    }

    /**
     * Persists an authentication token in localStorage.
     */
    store(token) {
        if (typeof token !== 'string' || !token.trim()) {
            return;
        }

        runStorageOperation((storage) => {
            storage.setItem(this.#storageKey, token.trim());
            return true;
        }, false);
    }

    /**
     * Clears the stored authentication token.
     */
    clear() {
        runStorageOperation((storage) => {
            storage.removeItem(this.#storageKey);
            return true;
        }, false);
    }
}

export class ApiClient {
    #request;
    #endpointResolver;

    /**
     * Creates an API client with pluggable transport and endpoint resolution.
     */
    constructor({ request, endpointResolver } = {}) {
        this.#request = request || new Request();
        this.#endpointResolver = endpointResolver || new ApiEndpointResolver();
    }

    /**
     * Executes an API request and returns a normalized frontend response object.
     */
    async request(path, { method = 'GET', body, token, headers = {} } = {}) {
        const endpoint = this.#endpointResolver.resolve(path);
        const normalizedMethod = typeof method === 'string' ? method.toUpperCase() : 'GET';

        const requestOptions = {
            headers: {
                Accept: 'application/json',
                ...headers,
            },
        };

        if (token) {
            requestOptions.headers.Authorization = `Bearer ${token}`;
        }

        try {
            const payload = await this.#dispatch(normalizedMethod, endpoint, body, requestOptions);

            return normalizeEnvelope({ ok: true, status: 200 }, payload);
        } catch (error) {
            if (error?.status) {
                const normalized = normalizeEnvelope(
                    { ok: false, status: error.status },
                    error.data,
                );

                if (!normalized.ok && !normalized.message) {
                    normalized.message = 'Falha ao processar a requisição.';
                }

                return normalized;
            }

            return {
                ok: false,
                status: 0,
                data: null,
                message: 'Não foi possível conectar ao servidor.',
                type: 'NetworkError',
                raw: error,
            };
        }
    }

    /**
     * Dispatches a normalized request through the Request helper.
     */
    async #dispatch(method, endpoint, body, requestOptions) {
        switch (method) {
        case 'GET':
            return this.#request.get(endpoint, requestOptions);
        case 'POST':
            return this.#request.post(endpoint, body, requestOptions);
        case 'PATCH':
            return this.#request.patch(endpoint, body, requestOptions);
        case 'PUT':
            return this.#request.put(endpoint, body, requestOptions);
        case 'DELETE':
            return this.#request.delete(endpoint, requestOptions);
        default:
            throw new Error(`Unsupported method: ${method}`);
        }
    }
}

export const apiClient = new ApiClient();
export const authTokenStore = new AuthTokenStore();

/**
 * Reads the stored auth token through the shared token store.
 */
export function readToken() {
    return authTokenStore.read();
}

/**
 * Persists an auth token through the shared token store.
 */
export function storeToken(token) {
    authTokenStore.store(token);
}

/**
 * Clears the stored auth token through the shared token store.
 */
export function clearToken() {
    authTokenStore.clear();
}

/**
 * Executes an API request through the shared API client instance.
 */
export async function requestApi(path, options = {}) {
    return apiClient.request(path, options);
}
