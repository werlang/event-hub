/**
 * TemplateVar
 * Reads server-injected template variables from the DOM.
 *
 * Usage:
 *   const value = TemplateVar.get('variableName');
 */

export class TemplateVar {

    static vars = {};
    static isBuilt = false;

    static build() {
        const script = document.querySelector('#template-vars');
        if (!script) return;

        try {
            const vars = JSON.parse(script.textContent);
            Object.entries(vars).forEach(([key, value]) => {
                TemplateVar.vars[key] = value;
            });
        }   
        catch (error) {
            console.error('Error parsing template variable:', error);
        }

        script.remove();
        TemplateVar.isBuilt = true;
    }

    static get(key) {
        if (!TemplateVar.isBuilt) {
            TemplateVar.build();
        }
        if (!key) {
            return TemplateVar.vars;
        }
        return TemplateVar.vars[key];
    }

    static set(key, value) {
        TemplateVar.vars[key] = value;
    }

}