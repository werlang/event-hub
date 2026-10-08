import { Email } from './email.js';
import { EmailTemplateManager } from './email-template-manager.js';

const EMAIL_VERIFICATION_TEMPLATE_KEY = 'email-verification-email';

/**
 * Normalizes the configured public web URL before verification links are composed.
 */
function normalizeWebBaseUrl(webBaseUrl) {
    const normalized = typeof webBaseUrl === 'string' ? webBaseUrl.trim() : '';
    return normalized.replace(/\/+$/u, '');
}

/**
 * Builds the public e-mail confirmation URL sent to the account owner.
 */
function buildVerificationUrl(webBaseUrl, token) {
    const normalizedBaseUrl = normalizeWebBaseUrl(webBaseUrl);
    if (!normalizedBaseUrl || !token) {
        return '';
    }

    const url = new URL('/verify-email', normalizedBaseUrl);
    url.searchParams.set('token', token);
    return url.toString();
}

/**
 * Renders and sends account-owner e-mail verification messages.
 */
export class EmailVerificationEmailManager {
    #emailHelper;
    #templateManager;
    #webBaseUrl;

    /**
     * Creates a verification e-mail manager with injectable dependencies for tests.
     */
    constructor({
        emailHelper = new Email({
            testing: process.env.EMAIL_TESTING === 'true',
        }),
        templateManager = new EmailTemplateManager(),
        webBaseUrl = process.env.WEB_URL || '',
    } = {}) {
        this.#emailHelper = emailHelper;
        this.#templateManager = templateManager;
        this.#webBaseUrl = webBaseUrl;
    }

    /**
     * Renders the verification e-mail for one user and raw confirmation token.
     */
    renderVerificationEmail(user, token) {
        const strings = this.#templateManager.loadJsonTemplate(EMAIL_VERIFICATION_TEMPLATE_KEY);
        const greeting = this.#templateManager.interpolateString(strings.greetingWithName || '', {
            name: user?.name || 'participante',
        });

        const content = this.#templateManager.loadTemplate(EMAIL_VERIFICATION_TEMPLATE_KEY, {
            brandName: strings.brandName || '',
            emailTitle: strings.emailTitle || '',
            eyebrowText: strings.eyebrowText || '',
            greeting,
            introText: strings.introText || '',
            reviewText: strings.reviewText || '',
            actionUrl: buildVerificationUrl(this.#webBaseUrl, token),
            buttonText: strings.buttonText || '',
            footerText: strings.footerText || '',
        });

        return {
            subject: strings.subject || '',
            content,
            actionUrl: buildVerificationUrl(this.#webBaseUrl, token),
        };
    }

    /**
     * Sends the confirmation link to the account e-mail address.
     */
    async sendVerificationEmail(user, token) {
        const email = typeof user?.email === 'string' ? user.email.trim().toLowerCase() : '';
        if (!email) {
            return null;
        }

        const message = this.renderVerificationEmail(user, token);
        const info = await this.#emailHelper.send([{
            email,
            name: user?.name || '',
        }], message.subject, message.content);

        return {
            email,
            messageId: info?.messageId || null,
            actionUrl: message.actionUrl,
        };
    }
}
