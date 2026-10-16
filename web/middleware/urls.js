/**
 * Build a full origin URL from a base host URL and an external port.
 *
 * @param {unknown} base Base host URL without port (e.g. `http://localhost`).
 * @param {unknown} port External port (e.g. `3000`); `80`/`443`/empty add nothing.
 * @returns {string} Full origin (e.g. `http://localhost:3000`) or `''` when empty.
 */
export function buildUrl(base, port) {
    const cleanBase = String(base ?? '').trim().replace(/\/+$/, '');
    if (!cleanBase) {
        return '';
    }

    let url;
    try {
        url = new URL(cleanBase);
    }
    catch {
        return cleanBase;
    }

    if (url.port) {
        return url.origin;
    }

    const portStr = String(port ?? '').trim();
    if (!portStr || !/^\d+$/.test(portStr) || portStr === '80' || portStr === '443') {
        return url.origin;
    }

    return `${url.origin}:${portStr}`;
}
