import { describe, expect, test } from '@jest/globals';
import { EmailTemplateManager } from '../../helpers/email-template-manager.js';

describe('helpers/email-template-manager', () => {
    test('loadJsonTemplate returns the localized string catalog', () => {
        const manager = new EmailTemplateManager();

        const strings = manager.loadJsonTemplate('notification-email');

        expect(strings).toMatchObject({
            subject: 'Notificação do Event Hub',
            emailTitle: 'Atualização do Event Hub',
            buttonText: 'Abrir Event Hub',
        });
    });

    test('loadTemplate escapes MJML placeholder values by default', () => {
        const manager = new EmailTemplateManager();

        const section = manager.loadTemplate(
            'notification-email-section',
            {
                label: '<Resumo>',
                value: '3 eventos <aprovados> nesta semana',
            },
        );

        expect(section).toContain('<strong>&lt;Resumo&gt;</strong> 3 eventos &lt;aprovados&gt; nesta semana');
        expect(section).toContain('<mj-section');
    });

    test('loadTemplate preserves trusted raw fragments', () => {
        const manager = new EmailTemplateManager();

        const content = manager.loadTemplate('notification-email', {
            emailTitle: 'Atualização',
            greeting: 'Olá,',
            introText: 'Resumo disponível.',
            summaryBlocks: manager.raw('<mj-section><mj-column><mj-text>Raw block</mj-text></mj-column></mj-section>'),
            reviewText: 'Confira abaixo.',
            actionUrl: 'https://event-hub.local/week?x=<tag>',
            buttonText: 'Abrir <Event Hub>',
            footerText: 'Rodapé',
        });

        expect(content).toContain('<mj-section><mj-column><mj-text>Raw block</mj-text></mj-column></mj-section>');
        expect(content).toContain('href="https://event-hub.local/week?x=&lt;tag&gt;"');
        expect(content).toContain('Abrir &lt;Event Hub&gt;');
    });

    test('the manager mirrors the reference flow of combining JSON strings with MJML templates', () => {
        const manager = new EmailTemplateManager();
        const strings = manager.loadJsonTemplate('notification-email');
        const greeting = manager.interpolateString(strings.greetingWithName, { name: 'Ada' });
        const summaryBlocks = manager.loadTemplate('notification-email-section', {
            label: strings.summaryLabel,
            value: 'A página semanal está pronta para envio.',
        });

        const content = manager.loadTemplate('notification-email', {
            emailTitle: strings.emailTitle,
            greeting,
            introText: strings.introText,
            summaryBlocks: manager.raw(summaryBlocks),
            reviewText: strings.reviewText,
            actionUrl: 'https://event-hub.local/week',
            buttonText: strings.buttonText,
            footerText: strings.footerText,
        });

        expect(content).toContain('Olá Ada,');
        expect(content).toContain('A página semanal está pronta para envio.');
        expect(content).toContain('https://event-hub.local/week');
        expect(content).toContain('<mj-button');
    });
});