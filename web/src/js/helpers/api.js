import { TemplateVar } from './template-var.js';
import { Request } from './request.js';

export const TOKEN_STORAGE_KEY = 'ae_token';

class ApiEndpointResolver {
    #sanitizeBaseUrl(url) {
        if (!url || typeof url !== 'string') {
            return '';
        }

        return url.replace(/\/$/, '');
    }

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

    #toAbsolutePath(path) {
        if (typeof path !== 'string' || !path) {
            return '/';
        }

        return path.startsWith('/') ? path : `/${path}`;
    }

    resolve(path) {
        return `${this.#resolveApiUrl()}${this.#toAbsolutePath(path)}`;
    }
}

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

class AuthTokenStore {
    #storageKey = TOKEN_STORAGE_KEY;

    read() {
        return localStorage.getItem(this.#storageKey);
    }

    store(token) {
        if (typeof token !== 'string' || !token.trim()) {
            return;
        }

        localStorage.setItem(this.#storageKey, token.trim());
    }

    clear() {
        localStorage.removeItem(this.#storageKey);
    }
}

export class ApiClient {
    #request;
    #endpointResolver;

    constructor({ request, endpointResolver } = {}) {
        this.#request = request || new Request();
        this.#endpointResolver = endpointResolver || new ApiEndpointResolver();
    }

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

    async #dispatch(method, endpoint, body, requestOptions) {
        switch (method) {
        case 'GET':
            return this.#request.get(endpoint, requestOptions);
        case 'POST':
            return this.#request.post(endpoint, body, requestOptions);
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

export function readToken() {
    return authTokenStore.read();
}

export function storeToken(token) {
    authTokenStore.store(token);
}

export function clearToken() {
    authTokenStore.clear();
}

export async function requestApi(path, options = {}) {
    return apiClient.request(path, options);
}
