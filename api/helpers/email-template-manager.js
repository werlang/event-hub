import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const RAW_TEMPLATE_VALUE = Symbol('raw-template-value');

/**
 * Loads localized email template files and performs placeholder interpolation outside the sender.
 */
export class EmailTemplateManager {
    #templateCache = null;
    #templatePath = null;

    /**
     * Creates one template manager rooted at the repository email template directory.
     *
     * @param {object} [options] Template loading options.
     * @param {string} [options.templatePath=join(__dirname, '../templates')] The root directory that contains localized template folders.
     */
    constructor({
        templatePath = join(__dirname, '../templates'),
    } = {}) {
        this.#templatePath = templatePath;
        this.#templateCache = {};
    }

    /**
     * Loads one template file and interpolates the provided placeholder values.
     *
     * @param {string} key The template key folder or extension.
     * @param {Record<string, unknown>} [variables={}] The placeholder values to interpolate.
     * @param {string} [extension='mjml'] The file extension to load.
     * @returns {string} The interpolated template content.
     */
    loadTemplate(key, variables = {}, extension = 'mjml') {
        const template = this.#readTemplateFile(key, extension);
        return this.interpolateString(template, this.#prepareTemplateVariables(variables));
    }

    /**
     * Loads one localized JSON template definition.
     *
     * @param {string} key The template key without extension.
     * @returns {Record<string, string>} The parsed JSON template strings.
     */
    loadJsonTemplate(key) {
        const content = this.#readTemplateFile(key, 'json');
        return JSON.parse(content);
    }

    /**
     * Replaces `{{variable}}` placeholders inside one template string.
     *
     * @param {string} template The template string to interpolate.
     * @param {Record<string, unknown>} [variables={}] The placeholder values to inject.
     * @returns {string} The interpolated template string.
     */
    interpolateString(template, variables = {}) {
        let content = String(template ?? '');

        for (const [variable, value] of Object.entries(variables)) {
            content = content.replaceAll(`{{${variable}}}`, String(value ?? ''));
        }

        return content;
    }

    /**
     * Escapes one string for safe interpolation into MJML or HTML content, converting line breaks to <br /> tags.
     *
     * @param {unknown} value The value to escape.
     * @returns {string} The escaped string.
     */
    escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;')
            .replaceAll('\r\n', '<br />')
            .replaceAll('\r', '<br />')
            .replaceAll('\n', '<br />');
    }

    /**
     * Marks one value as a trusted raw fragment that should bypass template escaping.
     *
     * @param {unknown} value The raw fragment value.
     * @returns {object} A wrapper recognized by the template renderer.
     */
    raw(value) {
        return {
            [RAW_TEMPLATE_VALUE]: true,
            value: String(value ?? ''),
        };
    }

    /**
     * Reads one localized template file from disk with cache fallback.
     *
     * @private
     * @param {string} key The template key without extension.
     * @param {string} [extension='mjml'] The file extension to load.
     * @returns {string} The template file content.
     */
    #readTemplateFile(key, extension = 'mjml') {
        if (!key) {
            throw new Error('Template key is required');
        }

        const cacheKey = `${key}.${extension}`;
        let template = this.#templateCache[cacheKey];

        if (!template) {
            const templateFile = `${key}.${extension}`;
            template = readFileSync(join(this.#templatePath, templateFile), 'utf-8');
            this.#templateCache[cacheKey] = template;
        }

        return template;
    }

    /**
     * Normalizes one interpolation map for escaped-by-default MJML rendering.
     *
     * @private
     * @param {Record<string, unknown>} variables The interpolation values.
     * @returns {Record<string, string>} The normalized interpolation values.
     */
    #prepareTemplateVariables(variables = {}) {
        return Object.fromEntries(Object.entries(variables).map(([key, value]) => [
            key,
            this.#stringifyTemplateValue(value),
        ]));
    }

    /**
     * Serializes one template value, escaping plain strings and preserving trusted raw fragments.
     *
     * @private
     * @param {unknown} value The value to serialize.
     * @returns {string} The serialized template value.
     */
    #stringifyTemplateValue(value) {
        if (value && typeof value === 'object' && value[RAW_TEMPLATE_VALUE] === true) {
            return String(value.value ?? '');
        }

        return this.escapeHtml(value);
    }
}