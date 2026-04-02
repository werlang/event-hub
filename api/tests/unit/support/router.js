/**
 * Returns the registered handlers for a route method and path.
 */
export function getRouteHandlers(router, method, path) {
    const normalizedMethod = String(method || '').toLowerCase();
    const layer = router.stack.find(candidate => candidate.route
        && candidate.route.path === path
        && candidate.route.methods[normalizedMethod]);

    if (!layer) {
        throw new Error(`Route not found: ${ normalizedMethod.toUpperCase() } ${ path }`);
    }

    return layer.route.stack.map(routeLayer => routeLayer.handle);
}

/**
 * Executes a route handler chain the same way Express would for unit tests.
 */
export async function runRouteHandlers(handlers, req, res, next) {
    async function dispatch(index, err) {
        if (err) {
            next(err);
            return;
        }

        if (index >= handlers.length) {
            return;
        }

        let forwarded = false;
        let forwardedError;

        try {
            await handlers[index](req, res, handlerError => {
                forwarded = true;
                forwardedError = handlerError;
            });
        } catch (error) {
            next(error);
            return;
        }

        if (forwarded) {
            await dispatch(index + 1, forwardedError);
        }
    }

    await dispatch(0);
}