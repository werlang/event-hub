import { describe, expect, test } from '@jest/globals';
import { EmailVerificationEmailManager } from '../../helpers/email-verification-email-manager.js';

function createTemplateManagerDouble() {
    return {
        loadJsonTemplate() {
            return {
                subject: 'Confirme seu e-mail',
                brandName: 'AgendaCharq',
                emailTitle: 'Confirme seu e-mail',
                eyebrowText: 'Confirmação',
                greetingWithName: 'Olá {{name}},',
                introText: 'Confirme que este e-mail é seu.',
                reviewText: 'Este link expira em 24 horas.',
                buttonText: 'Confirmar minha conta',
                footerText: 'Mensagem automática.',
            };
        },
        interpolateString(template, variables = {}) {
            return String(template).replaceAll('{{name}}', variables.name || '');
        },
        loadTemplate(_key, variables = {}) {
            return [
                variables.brandName,
                variables.greeting,
                variables.actionUrl,
                variables.buttonText,
            ].join('|');
        },
    };
}

describe('helpers/email-verification-email-manager', () => {
    test('renderVerificationEmail builds the public confirmation link from WEB_URL', () => {
        const manager = new EmailVerificationEmailManager({
            templateManager: createTemplateManagerDouble(),
            webBaseUrl: 'https://agenda.example/',
        });

        const message = manager.renderVerificationEmail({
            name: 'Ada',
            email: 'ada@example.com',
        }, 'raw-token');

        expect(message).toEqual({
            subject: 'Confirme seu e-mail',
            content: 'AgendaCharq|Olá Ada,|https://agenda.example/verify-email?token=raw-token|Confirmar minha conta',
            actionUrl: 'https://agenda.example/verify-email?token=raw-token',
        });
    });

    test('sendVerificationEmail normalizes the recipient and returns delivery metadata', async () => {
        const sentMessages = [];
        const manager = new EmailVerificationEmailManager({
            templateManager: createTemplateManagerDouble(),
            webBaseUrl: 'https://agenda.example',
            emailHelper: {
                async send(to, subject, content) {
                    sentMessages.push({ to, subject, content });
                    return { messageId: 'msg-verification' };
                },
            },
        });

        await expect(manager.sendVerificationEmail({
            name: 'Ada',
            email: ' ADA@EXAMPLE.COM ',
        }, 'raw-token')).resolves.toEqual({
            email: 'ada@example.com',
            messageId: 'msg-verification',
            actionUrl: 'https://agenda.example/verify-email?token=raw-token',
        });
        expect(sentMessages).toEqual([{
            to: [{
                email: 'ada@example.com',
                name: 'Ada',
            }],
            subject: 'Confirme seu e-mail',
            content: 'AgendaCharq|Olá Ada,|https://agenda.example/verify-email?token=raw-token|Confirmar minha conta',
        }]);

        await expect(manager.sendVerificationEmail({ email: '' }, 'raw-token')).resolves.toBeNull();
    });
});
