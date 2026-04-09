import nodemailer from 'nodemailer';
import { convert as htmlToText } from 'html-to-text';
import mjml2html from 'mjml';

/**
 * Resolves the default sender header from the configured SMTP environment variables.
 *
 * @returns {string} The formatted sender string used by Nodemailer.
 */
function resolveDefaultFrom() {
    if (process.env.SMTP_FROM_NAME && process.env.SMTP_FROM_EMAIL) {
        return `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`;
    }

    return process.env.SMTP_FROM || '';
}

/**
 * Sends emails through SMTP and compiles MJML bodies when needed.
 */
export class Email {
    #transporter = null;
    #from = null;
    #defaultSubject = null;
    #testing = true;

    /**
     * Creates one email sender instance.
     *
     * @param {object} [options] The SMTP and default email configuration.
     * @param {string} [options.host=process.env.SMTP_HOST] The SMTP server host.
     * @param {number|string} [options.port=process.env.SMTP_PORT || 587] The SMTP server port.
     * @param {boolean} [options.secure=process.env.SMTP_SECURE === 'true'] Whether the SMTP server uses TLS.
     * @param {string} [options.user=process.env.SMTP_USER] The SMTP username.
     * @param {string} [options.password=process.env.SMTP_PASSWORD] The SMTP password.
     * @param {string} [options.from=resolveDefaultFrom()] The sender header used for outgoing messages.
     * @param {string|null} [options.defaultSubject=null] The fallback subject when `send` omits one.
     * @param {boolean} [options.testing] Whether to use an Ethereal test account instead of a real SMTP server.
     */
    constructor({
        host = process.env.SMTP_HOST,
        port = process.env.SMTP_PORT || 587,
        secure = process.env.SMTP_SECURE === 'true',
        user = process.env.SMTP_USER,
        password = process.env.SMTP_PASSWORD,
        from = resolveDefaultFrom(),
        defaultSubject = null,
        testing,
    } = {}) {
        this.#from = from;
        this.#defaultSubject = defaultSubject;
        this.#testing = testing !== undefined ? testing : this.#testing;

        if (this.#testing) {
            return;
        }

        this.#createTransporter({ host, port, secure, user, password });
    }

    /**
     * Creates the Nodemailer transporter for one SMTP configuration.
     *
     * @private
     * @param {object} config The SMTP configuration.
     * @param {string} config.host The SMTP server host.
     * @param {number|string} config.port The SMTP server port.
     * @param {boolean} config.secure Whether TLS is enabled.
     * @param {string} [config.user] The SMTP username.
     * @param {string} [config.password] The SMTP password.
     */
    #createTransporter(config) {
        try {
            this.#transporter = nodemailer.createTransport({
                host: config.host,
                port: Number(config.port),
                secure: config.secure,
                auth: config.user && config.password
                    ? {
                        user: config.user,
                        pass: config.password,
                    }
                    : undefined,
            });
        } catch (error) {
            console.error('Error creating email transporter:', error);
            throw new Error(`Failed to create email transporter: ${error.message}`);
        }
    }

    /**
     * Creates one Ethereal transporter for test-mode deliveries.
     *
     * @private
     * @returns {Promise<void>}
     */
    async #createTestingTransporter() {
        const testAccount = await nodemailer.createTestAccount();
        const host = testAccount.smtp.host;
        const port = testAccount.smtp.port;
        const secure = testAccount.smtp.secure;
        const user = testAccount.user;
        const password = testAccount.pass;

        console.log('Testing mode enabled - using Ethereal test account:', {
            host,
            port,
            secure,
            user,
            password,
        });

        this.#createTransporter({ host, port, secure, user, password });
    }

    /**
     * Validates one email address string.
     *
     * @private
     * @param {string} email The email address to validate.
     * @returns {boolean} Whether the address matches the expected basic shape.
     */
    #validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Validates one recipient list.
     *
     * @private
     * @param {string[]} recipients The recipient list to validate.
     */
    #validateRecipients(recipients) {
        if (!Array.isArray(recipients) || recipients.length === 0) {
            throw new Error('Recipients must be a non-empty array');
        }

        for (const email of recipients) {
            if (!this.#validateEmail(email)) {
                throw new Error(`Invalid email address: ${email}`);
            }
        }
    }

    /**
     * Compiles one MJML template into HTML.
     *
     * @private
     * @param {string} mjmlContent The MJML template content.
     * @returns {string} The compiled HTML string.
     */
    #compileMjml(mjmlContent) {
        try {
            const result = mjml2html(mjmlContent, {
                validationLevel: 'soft',
            });

            if (result.errors.length > 0) {
                console.warn('MJML compilation warnings:', result.errors);
            }

            return result.html;
        } catch (error) {
            throw new Error(`MJML compilation error: ${error.message}`);
        }
    }

    /**
     * Generates one plain-text alternative from HTML content.
     *
     * @private
     * @param {string} htmlContent The HTML content to convert.
     * @returns {string} The generated plain-text content.
     */
    #generateTextFromHtml(htmlContent) {
        return htmlToText(htmlContent, {
            wordwrap: 120,
            selectors: [
                {
                    selector: 'a',
                    options: {
                        hideLinkHrefIfSameAsText: true,
                    },
                },
            ],
        });
    }

    /**
     * Returns whether one body string is MJML.
     *
     * @private
     * @param {string} content The content to inspect.
     * @returns {boolean} Whether the content starts with an MJML root tag.
     */
    #isMjml(content) {
        return content.trim().startsWith('<mjml');
    }

    /**
     * Returns whether one body string looks like HTML.
     *
     * @private
     * @param {string} content The content to inspect.
     * @returns {boolean} Whether the content appears to contain HTML tags.
     */
    #isHtml(content) {
        const htmlTagRegex = /<[a-z][\s\S]*>/i;
        return htmlTagRegex.test(content);
    }

    /**
     * Removes header-like injection lines from one plain-text body.
     *
     * @private
     * @param {string} content The plain-text body to sanitize.
     * @returns {string} The sanitized text content.
     */
    #sanitizeBody(content) {
        return content.replace(/(?:\r\n|\r|\n)[ \t]*[\w-]+\s*:.*(?=(?:\r\n|\r|\n|$))/gi, '');
    }

    /**
     * Sends one email message.
     *
     * @param {string[]} to The primary recipient list.
     * @param {string|null} subject The email subject.
     * @param {string} body The body string, which may be plain text, HTML, or MJML.
     * @param {object} [options] Additional mail options.
     * @param {string|string[]} [options.cc] Optional carbon-copy recipients.
     * @param {string|string[]} [options.bcc] Optional blind carbon-copy recipients.
     * @param {string} [options.from] Optional sender override.
     * @param {string} [options.text] Optional explicit text body.
     * @param {string} [options.html] Optional explicit HTML body.
     * @param {Array<object>} [options.attachments] Optional attachment definitions.
     * @returns {Promise<object>} The Nodemailer delivery info.
     */
    async send(to, subject, body, options = {}) {
        this.#validateRecipients(to);

        const ccRecipients = options.cc
            ? (Array.isArray(options.cc) ? options.cc : [options.cc])
            : null;
        const bccRecipients = options.bcc
            ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc])
            : null;

        if (ccRecipients) {
            this.#validateRecipients(ccRecipients);
        }

        if (bccRecipients) {
            this.#validateRecipients(bccRecipients);
        }

        if (!subject && !this.#defaultSubject) {
            throw new Error('Subject is required');
        }

        if (!body) {
            throw new Error('Body is required');
        }

        const finalSubject = subject || this.#defaultSubject;
        let html = null;
        let text = null;
        const isMjmlBody = this.#isMjml(body);
        const isHtmlBody = !isMjmlBody && this.#isHtml(body);

        if (isMjmlBody) {
            html = this.#compileMjml(body);
            text = this.#generateTextFromHtml(html);
        } else if (isHtmlBody) {
            html = body;
            text = this.#generateTextFromHtml(html);
        } else {
            text = this.#sanitizeBody(body);
        }

        const mailOptions = {
            from: options.from || this.#from,
            to: to.join(', '),
            subject: finalSubject,
            text: options.text || text,
            html: html || options.html,
            cc: ccRecipients ? ccRecipients.join(', ') : undefined,
            bcc: bccRecipients ? bccRecipients.join(', ') : undefined,
            attachments: options.attachments,
        };

        if (this.#testing && !this.#transporter) {
            await this.#createTestingTransporter();
        }

        try {
            const info = await this.#transporter.sendMail(mailOptions);
            console.log(`Email sent successfully: ${info.messageId}`);

            if (this.#testing) {
                console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
            }

            return info;
        } catch (error) {
            console.error('Error sending email:', error);
            throw new Error(`Failed to send email: ${error.message}`);
        }
    }

    /**
     * Verifies the configured SMTP connection.
     *
     * @returns {Promise<boolean>} Whether the connection is ready.
     */
    async verify() {
        if (this.#testing) {
            console.log('Testing mode enabled - skipping SMTP verification.');
            return true;
        }

        try {
            await this.#transporter.verify();
            console.log('SMTP connection verified successfully');
            return true;
        } catch (error) {
            console.error('SMTP connection error:', error);
            throw new Error(`SMTP verification failed: ${error.message}`);
        }
    }

    /**
     * Closes the SMTP transporter when a real connection is in use.
     */
    close() {
        if (this.#testing) {
            console.log('Testing mode enabled - skipping transporter close.');
            return;
        }

        this.#transporter.close();
    }
}