import { TemplateVar } from './template-var.js';

export const TOKEN_STORAGE_KEY = 'ae_token';

function sanitizeBaseUrl(url) {
    if (!url || typeof url !== 'string') {
        return '';
    }

    return url.replace(/\/$/, '');
}

function resolveApiUrl() {
    const fromTemplate = TemplateVar.get('apiUrl');
    if (fromTemplate) {
        return sanitizeBaseUrl(fromTemplate);
    }

    const fromMeta = document.querySelector('meta[name="api-url"]')?.getAttribute('content');
    if (fromMeta) {
        return sanitizeBaseUrl(fromMeta);
    }

    return '';
}

function toAbsolutePath(path) {
    if (typeof path !== 'string' || !path) {
        return '/';
    }

    return path.startsWith('/') ? path : `/${path}`;
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

export function readToken() {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function storeToken(token) {
    if (typeof token !== 'string' || !token.trim()) {
        return;
    }

    localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
}

export function clearToken() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export async function requestApi(path, { method = 'GET', body, token, headers = {} } = {}) {
    const apiUrl = resolveApiUrl();
    const endpoint = `${apiUrl}${toAbsolutePath(path)}`;

    const fetchOptions = {
        method,
        headers: {
            Accept: 'application/json',
            ...headers,
        },
    };

    if (body !== undefined) {
        fetchOptions.headers['Content-Type'] = 'application/json';
        fetchOptions.body = JSON.stringify(body);
    }

    if (token) {
        fetchOptions.headers.Authorization = `Bearer ${token}`;
    }

    try {
        const response = await fetch(endpoint, fetchOptions);
        const contentType = response.headers.get('content-type') || '';
        const payload = contentType.includes('application/json')
            ? await response.json()
            : null;

        const normalized = normalizeEnvelope(response, payload);
        if (!normalized.ok && !normalized.message && !response.ok) {
            normalized.message = 'Falha ao processar a requisição.';
        }

        return normalized;
    } catch (error) {
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
