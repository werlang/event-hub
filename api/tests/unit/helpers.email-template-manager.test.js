import { describe, expect, test } from '@jest/globals';
import { EmailTemplateManager } from '../../helpers/email-template-manager.js';

describe('helpers/email-template-manager', () => {
    test('loadJsonTemplate returns the localized string catalog', () => {
        const manager = new EmailTemplateManager();

        const strings = manager.loadJsonTemplate('notification-email');

        expect(strings).toMatchObject({
            subject: 'AgendaCharq - Novo evento aguardando moderação',
            brandName: 'AgendaCharq',
            eyebrowText: 'Central de notificações',
            emailTitle: 'Evento aguardando moderação',
            buttonText: 'Abrir na AgendaCharq',
            summaryLabel: 'Evento',
        });
    });

    test('loadTemplate escapes MJML placeholder values by default', () => {
        const manager = new EmailTemplateManager();

        const section = manager.loadTemplate(
            'notification-email-section',
            {
                cardLabel: '<Resumo>',
                eventTitle: 'Feira <Aberta>',
                actorText: 'Organizador: Ada <Lovelace>',
                eventDescription: '3 eventos <aprovados> nesta semana',
                eventDateLabel: 'Quando',
                eventDateValue: 'Quinta-feira, 11 de junho de 2026 às 19:00',
                locationLabel: 'Local',
                locationValue: 'Auditório <Central>',
                categoryLabel: 'Categoria',
                categoryValue: 'Acadêmico <STEM>',
            },
        );

        expect(section).toContain('&lt;Resumo&gt;');
        expect(section).toContain('Feira &lt;Aberta&gt;');
        expect(section).toContain('Organizador: Ada &lt;Lovelace&gt;');
        expect(section).toContain('3 eventos &lt;aprovados&gt; nesta semana');
        expect(section).toContain('Auditório &lt;Central&gt;');
        expect(section).toContain('Acadêmico &lt;STEM&gt;');
        expect(section).toContain('text-transform="uppercase"');
        expect(section).toContain('<mj-section');
    });

    test('loadTemplate preserves trusted raw fragments', () => {
        const manager = new EmailTemplateManager();

        const content = manager.loadTemplate('notification-email', {
            brandName: 'Marca <Hub>',
            emailTitle: 'Atualização',
            eyebrowText: 'Faixa <superior>',
            greeting: 'Olá,',
            introText: 'Resumo disponível.',
            summaryTitle: 'Resumo do evento',
            summaryDescriptionText: 'Contexto <rápido>.',
            summaryBlocks: manager.raw('<mj-section><mj-column><mj-text>Raw block</mj-text></mj-column></mj-section>'),
            reviewText: 'Confira abaixo.',
            actionUrl: 'https://agenda-ch.local/week?x=<tag>',
            buttonText: 'Abrir <AgendaCharq>',
            footerText: 'Rodapé',
        });

        expect(content).toContain('<mj-section><mj-column><mj-text>Raw block</mj-text></mj-column></mj-section>');
        expect(content).toContain('href="https://agenda-ch.local/week?x=&lt;tag&gt;"');
        expect(content).toContain('Marca &lt;Hub&gt;');
        expect(content).toContain('Faixa &lt;superior&gt;');
        expect(content).not.toContain('Contexto &lt;rápido&gt;.');
        expect(content).toContain('Abrir &lt;AgendaCharq&gt;');
    });

    test('the manager mirrors the reference flow of combining JSON strings with MJML templates', () => {
        const manager = new EmailTemplateManager();
        const strings = manager.loadJsonTemplate('notification-email');
        const greeting = manager.interpolateString(strings.greetingWithName, { name: 'Ada' });
        const summaryBlocks = manager.loadTemplate('notification-email-section', {
            cardLabel: strings.summaryLabel,
            eventTitle: 'A página semanal está pronta',
            actorText: 'Organizador: Ada',
            eventDescription: 'A página semanal está pronta para envio.',
            eventDateLabel: strings.dateLabel,
            eventDateValue: 'Sexta-feira, 12 de junho de 2026 às 08:00',
            locationLabel: strings.locationLabel,
            locationValue: 'Laboratório 2',
            categoryLabel: strings.categoryLabel,
            categoryValue: 'Acadêmico',
        });

        const content = manager.loadTemplate('notification-email', {
            brandName: strings.brandName,
            emailTitle: strings.emailTitle,
            eyebrowText: strings.eyebrowText,
            greeting,
            introText: strings.introText,
            summaryTitle: strings.summaryLabel,
            summaryDescriptionText: strings.summaryDescriptionText,
            summaryBlocks: manager.raw(summaryBlocks),
            reviewText: strings.reviewText,
            actionUrl: 'https://agenda-ch.local/week',
            buttonText: strings.buttonText,
            footerText: strings.footerText,
        });

        expect(content).toContain('Olá Ada,');
        expect(content).toContain('A página semanal está pronta para envio.');
        expect(content).toContain('https://agenda-ch.local/week');
        expect(content).toContain('Central de notificações');
        expect(content).toContain('<mj-button');
    });
});