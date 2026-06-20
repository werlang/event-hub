import { Email } from './email.js';
import { EmailTemplateManager } from './email-template-manager.js';

const PASSWORD_RESET_TEMPLATE_KEY = 'password-reset-email';

/**
 * Normalizes the configured public web URL before reset links are composed.
 */
function normalizeWebBaseUrl(webBaseUrl) {
    const normalized = typeof webBaseUrl === 'string' ? webBaseUrl.trim() : '';
    return normalized.replace(/\/+$/u, '');
}

/**
 * Builds the public reset-password URL sent to the account owner.
 */
function buildResetPasswordUrl(webBaseUrl, token) {
    const normalizedBaseUrl = normalizeWebBaseUrl(webBaseUrl);
    if (!normalizedBaseUrl || !token) {
        return '';
    }

    const url = new URL('/reset-password', normalizedBaseUrl);
    url.searchParams.set('token', token);
    return url.toString();
}

/**
 * Renders and sends account-owner password reset e-mails.
 */
export class PasswordResetEmailManager {
    #emailHelper;
    #templateManager;
    #webBaseUrl;

    /**
     * Creates a password-reset e-mail manager with injectable dependencies for tests.
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
     * Renders the password-reset e-mail for one user and raw reset token.
     */
    renderPasswordResetEmail(user, token) {
        const strings = this.#templateManager.loadJsonTemplate(PASSWORD_RESET_TEMPLATE_KEY);
        const greeting = this.#templateManager.interpolateString(strings.greetingWithName || '', {
            name: user?.name || 'participante',
        });

        const content = this.#templateManager.loadTemplate(PASSWORD_RESET_TEMPLATE_KEY, {
            brandName: strings.brandName || '',
            emailTitle: strings.emailTitle || '',
            eyebrowText: strings.eyebrowText || '',
            greeting,
            introText: strings.introText || '',
            reviewText: strings.reviewText || '',
            actionUrl: buildResetPasswordUrl(this.#webBaseUrl, token),
            buttonText: strings.buttonText || '',
            footerText: strings.footerText || '',
        });

        return {
            subject: strings.subject || '',
            content,
            actionUrl: buildResetPasswordUrl(this.#webBaseUrl, token),
        };
    }

    /**
     * Sends the reset link to the account e-mail address.
     */
    async sendPasswordResetEmail(user, token) {
        const email = typeof user?.email === 'string' ? user.email.trim().toLowerCase() : '';
        if (!email) {
            return null;
        }

        const message = this.renderPasswordResetEmail(user, token);
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
