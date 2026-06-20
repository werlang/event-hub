import { describe, expect, test } from '@jest/globals';
import { PasswordResetEmailManager } from '../../helpers/password-reset-email-manager.js';

function createTemplateManagerDouble() {
    return {
        loadJsonTemplate() {
            return {
                subject: 'Redefina sua senha',
                brandName: 'AgendaCharq',
                emailTitle: 'Redefina sua senha',
                eyebrowText: 'Recuperação',
                greetingWithName: 'Olá {{name}},',
                introText: 'Use o link enviado para redefinir sua senha.',
                reviewText: 'Este link expira em 15 minutos.',
                buttonText: 'Escolher nova senha',
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

describe('helpers/password-reset-email-manager', () => {
    test('renderPasswordResetEmail builds the public reset link from WEB_URL', () => {
        const manager = new PasswordResetEmailManager({
            templateManager: createTemplateManagerDouble(),
            webBaseUrl: 'https://agenda.example/',
        });

        const message = manager.renderPasswordResetEmail({
            name: 'Ada',
            email: 'ada@example.com',
        }, 'raw-token');

        expect(message).toEqual({
            subject: 'Redefina sua senha',
            content: 'AgendaCharq|Olá Ada,|https://agenda.example/reset-password?token=raw-token|Escolher nova senha',
            actionUrl: 'https://agenda.example/reset-password?token=raw-token',
        });
    });

    test('sendPasswordResetEmail normalizes the recipient and returns delivery metadata', async () => {
        const sentMessages = [];
        const manager = new PasswordResetEmailManager({
            templateManager: createTemplateManagerDouble(),
            webBaseUrl: 'https://agenda.example',
            emailHelper: {
                async send(to, subject, content) {
                    sentMessages.push({ to, subject, content });
                    return { messageId: 'msg-reset' };
                },
            },
        });

        await expect(manager.sendPasswordResetEmail({
            name: 'Ada',
            email: ' ADA@EXAMPLE.COM ',
        }, 'raw-token')).resolves.toEqual({
            email: 'ada@example.com',
            messageId: 'msg-reset',
            actionUrl: 'https://agenda.example/reset-password?token=raw-token',
        });
        expect(sentMessages).toEqual([{
            to: [{
                email: 'ada@example.com',
                name: 'Ada',
            }],
            subject: 'Redefina sua senha',
            content: 'AgendaCharq|Olá Ada,|https://agenda.example/reset-password?token=raw-token|Escolher nova senha',
        }]);

        await expect(manager.sendPasswordResetEmail({ email: '' }, 'raw-token')).resolves.toBeNull();
    });
});
