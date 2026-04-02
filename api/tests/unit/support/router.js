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