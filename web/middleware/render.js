export const renderMiddleware = fixedVars => (req, res, next) => {
    res.templateRender = async (view, templateVars = {}) => {
        // set fixed variables
        templateVars = {
            ...fixedVars,
            ...templateVars,
        };

        // eliminate undefined values
        for (let key in templateVars) {
            if (!templateVars[key]) {
                delete templateVars[key];
            }
        }

        const vars = {
            // send the templateVars script in the template. Frontend will read this and store it in a class
            'template-vars': `<script id="template-vars" type="application/json">${JSON.stringify(templateVars)}</script>`,
            // send the templateVars to replace the view
            ...templateVars,
        };
        res.render(view, vars);
    }
    next();
};