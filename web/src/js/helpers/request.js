/**
 * Request
 * Fetch wrapper with base URL, JSON headers, and timeout.
 *
 * Usage:
 *   const api = new Request({ baseURL: '/api' });
 *   const data = await api.get('/timetables');
 */

export class Request {
    #baseURL = '';
    #defaultHeaders = {
        'Content-Type': 'application/json'
    };
    #timeout = 30000; // 30 seconds default timeout

    /**
     * Creates a fetch wrapper with optional base URL, headers, and timeout.
     */
    constructor({ baseURL, headers, timeout } = {}) {
        if (baseURL !== undefined) this.#baseURL = baseURL;
        if (headers !== undefined) this.#defaultHeaders = { ...this.#defaultHeaders, ...headers };
        if (timeout !== undefined) this.#timeout = timeout;
    }

    /**
     * Make a request with automatic error handling
     */
    async #request(url, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.#timeout);

        try {
            const fullURL = this.#baseURL + url;
            const config = {
                ...options,
                headers: {
                    ...this.#defaultHeaders,
                    ...options.headers
                },
                signal: controller.signal
            };

            const response = await fetch(fullURL, config);
            clearTimeout(timeoutId);

            const contentType = response.headers.get('content-type');
            const parseBody = async () => {
                if (contentType?.includes('application/json')) {
                    return await response.json();
                }
                if (contentType?.includes('text/')) {
                    return await response.text();
                }
                return null;
            };

            if (!response.ok) {
                const errorData = await parseBody();
                const requestError = new Error(`HTTP ${response.status}: ${response.statusText}`);
                requestError.status = response.status;
                requestError.data = errorData;
                throw requestError;
            }

            return await parseBody();

        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        }
    }

    /**
     * GET request
     */
    async get(url, options = {}) {
        return this.#request(url, {
            ...options,
            method: 'GET'
        });
    }

    /**
     * POST request
     */
    async post(url, data, options = {}) {
        return this.#request(url, {
            ...options,
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * PUT request
     */
    async put(url, data, options = {}) {
        return this.#request(url, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    /**
     * DELETE request
     */
    async delete(url, options = {}) {
        return this.#request(url, {
            ...options,
            method: 'DELETE'
        });
    }
}
