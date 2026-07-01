/**
 * Safely serializes JSON for embedding inside a script tag.
 */
export function safeJsonStringify(value) {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}

/**
 * Creates middleware that injects shared template variables and a render helper.
 */
export const renderMiddleware = fixedVars => (req, res, next) => {
    /**
     * Renders a view with the merged fixed and request-scoped template variables.
     */
    res.templateRender = async (view, templateVars = {}) => {
        // set fixed variables
        templateVars = {
            ...fixedVars,
            ...templateVars,
        };

        // eliminate undefined values while preserving valid falsy data for pages
        for (let key in templateVars) {
            if (templateVars[key] === undefined) {
                delete templateVars[key];
            }
        }

        const vars = {
            // send the templateVars script in the template. Frontend will read this and store it in a class
            'template-vars': `<script id="template-vars" type="application/json">${safeJsonStringify(templateVars)}</script>`,
            // send the templateVars to replace the view
            ...templateVars,
        };
        res.render(view, vars);
    }
    next();
};
