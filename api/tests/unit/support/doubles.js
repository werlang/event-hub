/**
 * Tracks a temporary property replacement and restores the original value later.
 */
export function trackReplacement(restores, target, property, replacement) {
    const descriptor = Object.getOwnPropertyDescriptor(target, property);
    target[property] = replacement;

    restores.push(() => {
        if (descriptor) {
            Object.defineProperty(target, property, descriptor);
            return;
        }

        delete target[property];
    });

    return replacement;
}

/**
 * Restores tracked replacements in reverse order.
 */
export function restoreTracked(restores) {
    while (restores.length > 0) {
        const restore = restores.pop();
        restore();
    }
}

/**
 * Creates a minimal Express-style response double for unit tests.
 */
export function createResponseDouble() {
    return {
        statusCode: 200,
        body: undefined,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
    };
}