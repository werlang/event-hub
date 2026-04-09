import { describe, expect, jest, test } from '@jest/globals';
import { EmailTemplateManager } from '../../helpers/email-template-manager.js';
import { EventUpdateNotificationManager } from '../../helpers/event-update-notification-manager.js';
import { buildEvent, buildUser } from './support/fixtures.js';

describe('helpers/event-update-notification-manager', () => {
    test('notifyEventUpdated sends one styled message to the opted-in owner', async () => {
        const emailHelper = {
            send: jest.fn(async ([email]) => ({
                messageId: `msg:${email}`,
            })),
        };
        const manager = new EventUpdateNotificationManager({
            emailHelper,
            templateManager: new EmailTemplateManager(),
            webBaseUrl: 'https://event-hub.test',
        });

        const result = await manager.notifyEventUpdated({
            event: buildEvent({
                title: 'Feira de Ciências Atualizada',
                description: 'Nova programação com oficinas extras.',
                date: '2026-06-11T19:00:00.000Z',
                status: 'pending',
                category: 'academico',
                location: 'Auditório Central',
            }),
            owner: buildUser({ id: 'user-9', name: 'Ada Lovelace', email: 'ADA@example.com' }),
            editor: buildUser({ id: 'admin-1', role: 'admin', name: 'Grace Hopper' }),
        });

        expect(emailHelper.send).toHaveBeenCalledTimes(1);
        expect(emailHelper.send).toHaveBeenCalledWith(
            ['ada@example.com'],
            'Atualização do seu evento no Event Hub',
            expect.stringContaining('Feira de Ciências Atualizada'),
        );
        expect(emailHelper.send.mock.calls[0][2]).toContain('Grace Hopper');
        expect(emailHelper.send.mock.calls[0][2]).toContain('https://event-hub.test/dashboard');
        expect(result).toEqual({
            delivery: {
                email: 'ada@example.com',
                messageId: 'msg:ada@example.com',
            },
            recipient: {
                email: 'ada@example.com',
                name: 'Ada Lovelace',
            },
            sentCount: 1,
            skipped: false,
        });
    });

    test('notifyEventUpdated skips owners who opted out of event-update emails', async () => {
        const emailHelper = {
            send: jest.fn(async () => ({
                messageId: 'msg:ignored',
            })),
        };
        const manager = new EventUpdateNotificationManager({
            emailHelper,
            templateManager: new EmailTemplateManager(),
            webBaseUrl: 'https://event-hub.test',
        });

        const result = await manager.notifyEventUpdated({
            event: buildEvent({ status: 'pending' }),
            owner: buildUser({
                emailPreferences: {
                    eventUpdates: false,
                    adminPendingRequests: true,
                },
            }),
            editor: buildUser({ id: 'admin-1', role: 'admin', name: 'Grace Hopper' }),
        });

        expect(emailHelper.send).not.toHaveBeenCalled();
        expect(result).toEqual({
            delivery: null,
            recipient: null,
            sentCount: 0,
            skipped: true,
        });
    });

    test('notifyEventDeleted sends one styled message to the opted-in owner', async () => {
        const emailHelper = {
            send: jest.fn(async ([email]) => ({
                messageId: `msg:${email}`,
            })),
        };
        const manager = new EventUpdateNotificationManager({
            emailHelper,
            templateManager: new EmailTemplateManager(),
            webBaseUrl: 'https://event-hub.test',
        });

        const result = await manager.notifyEventDeleted({
            event: buildEvent({
                title: 'Feira de Ciências Cancelada',
                description: 'Versão excluída pela administração.',
                date: '2026-06-11T19:00:00.000Z',
                status: 'published',
                category: 'academico',
                location: 'Auditório Central',
            }),
            owner: buildUser({ id: 'user-9', name: 'Ada Lovelace', email: 'ADA@example.com' }),
            editor: buildUser({ id: 'admin-1', role: 'admin', name: 'Grace Hopper' }),
        });

        expect(emailHelper.send).toHaveBeenCalledTimes(1);
        expect(emailHelper.send).toHaveBeenCalledWith(
            ['ada@example.com'],
            'Seu evento foi removido do Event Hub',
            expect.stringContaining('Feira de Ciências Cancelada'),
        );
        expect(emailHelper.send.mock.calls[0][2]).toContain('Grace Hopper');
        expect(emailHelper.send.mock.calls[0][2]).toContain('https://event-hub.test/dashboard');
        expect(result).toEqual({
            delivery: {
                email: 'ada@example.com',
                messageId: 'msg:ada@example.com',
            },
            recipient: {
                email: 'ada@example.com',
                name: 'Ada Lovelace',
            },
            sentCount: 1,
            skipped: false,
        });
    });

    test('renderEventUpdatedEmail escapes event fields while preserving the MJML section layout', () => {
        const manager = new EventUpdateNotificationManager({
            emailHelper: { send: jest.fn() },
            templateManager: new EmailTemplateManager(),
            webBaseUrl: 'https://event-hub.test',
        });

        const message = manager.renderEventUpdatedEmail(buildUser({ name: 'Ada <owner>' }), {
            event: buildEvent({
                title: '<script>alert(1)</script>',
                description: 'Linha 1 <b>forte</b>',
                date: '2026-06-11T19:00:00.000Z',
                location: 'Lab <B>',
                categoryLabel: 'Acadêmico <x>',
            }),
            editor: buildUser({ id: 'admin-1', role: 'admin', name: 'Grace <admin>' }),
        });

        expect(message.subject).toBe('Atualização do seu evento no Event Hub');
        expect(message.content).toContain('Olá Ada &lt;owner&gt;,');
        expect(message.content).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(message.content).toContain('Linha 1 &lt;b&gt;forte&lt;/b&gt;');
        expect(message.content).toContain('Grace &lt;admin&gt;');
        expect(message.content).toContain('Acadêmico &lt;x&gt;');
        expect(message.content).not.toContain('&lt;mj-section');
        expect(message.content).toContain('<mj-section');
    });
});