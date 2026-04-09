import { describe, expect, jest, test } from '@jest/globals';
import { EmailTemplateManager } from '../../helpers/email-template-manager.js';
import { PendingEventNotificationManager } from '../../helpers/pending-event-notification-manager.js';
import { User } from '../../model/user.js';
import { buildEvent, buildUser } from './support/fixtures.js';

describe('helpers/pending-event-notification-manager', () => {
    test('notifyPendingApproval skips delivery when there are no opted-in admin recipients', async () => {
        const logger = {
            error: jest.fn(),
            info: jest.fn(),
        };
        const manager = new PendingEventNotificationManager({
            emailHelper: { send: jest.fn() },
            logger,
            templateManager: new EmailTemplateManager(),
            userModel: {
                listEmailPreferenceRecipients: jest.fn(async () => []),
            },
            webBaseUrl: 'https://event-hub.test',
        });

        const result = await manager.notifyPendingApproval({
            event: buildEvent(),
            organizer: buildUser(),
        });

        expect(result).toEqual({
            deliveries: [],
            failures: [],
            failedCount: 0,
            recipientCount: 0,
            sentCount: 0,
        });
        expect(logger.info).toHaveBeenCalledWith('Pending-event notification skipped because there are no opted-in admin recipients.');
    });

    test('notifyPendingApproval sends one styled message per opted-in admin email address', async () => {
        const emailHelper = {
            send: jest.fn(async ([email]) => ({
                messageId: `msg:${email}`,
            })),
        };
        const userModel = {
            listEmailPreferenceRecipients: jest.fn(async () => ([
                buildUser({ id: 'admin-1', role: 'admin', email: 'ADMIN@example.com' }),
                buildUser({ id: 'admin-2', role: 'admin', name: 'Grace Hopper', email: 'grace@example.com' }),
                buildUser({ id: 'admin-3', role: 'admin', name: 'Duplicado', email: 'admin@example.com' }),
                buildUser({ id: 'admin-4', role: 'admin', name: 'Sem email', email: '   ' }),
            ])),
        };
        const manager = new PendingEventNotificationManager({
            emailHelper,
            templateManager: new EmailTemplateManager(),
            userModel,
            webBaseUrl: 'https://event-hub.test',
        });

        const result = await manager.notifyPendingApproval({
            event: buildEvent({
                title: 'Feira de Ciências',
                description: 'Apresentações abertas para a comunidade.',
                date: '2026-06-11T19:00:00.000Z',
                location: 'Auditório Central',
                category: 'academico',
            }),
            organizer: buildUser({ id: 'user-9', name: 'Ada Lovelace' }),
        });

        expect(userModel.listEmailPreferenceRecipients).toHaveBeenCalledWith(User.EMAIL_PREFERENCE_KEYS.adminPendingRequests, {
            role: 'admin',
            view: ['id', 'name', 'email'],
        });
        expect(emailHelper.send).toHaveBeenCalledTimes(2);
        expect(emailHelper.send.mock.calls.map((call) => call[0])).toEqual([
            ['admin@example.com'],
            ['grace@example.com'],
        ]);
        expect(emailHelper.send.mock.calls[0][1]).toBe('Event Hub - Novo evento aguardando moderação');
        expect(emailHelper.send.mock.calls[0][2]).toContain('Feira de Ciências');
        expect(emailHelper.send.mock.calls[0][2]).toContain('Ada Lovelace');
        expect(emailHelper.send.mock.calls[0][2]).toContain('https://event-hub.test/dashboard');
        expect(result).toMatchObject({
            failedCount: 0,
            failures: [],
            recipientCount: 2,
            sentCount: 2,
        });
    });

    test('notifyPendingApproval keeps sending later emails when one admin delivery fails', async () => {
        const deliveryError = new Error('smtp timeout');
        const logger = {
            error: jest.fn(),
            info: jest.fn(),
        };
        const emailHelper = {
            send: jest.fn(async ([email]) => {
                if (email === 'admin@example.com') {
                    throw deliveryError;
                }

                return {
                    messageId: `msg:${email}`,
                };
            }),
        };
        const userModel = {
            listEmailPreferenceRecipients: jest.fn(async () => ([
                buildUser({ id: 'admin-1', role: 'admin', email: 'admin@example.com' }),
                buildUser({ id: 'admin-2', role: 'admin', email: 'grace@example.com' }),
                buildUser({ id: 'admin-3', role: 'admin', email: 'linus@example.com' }),
            ])),
        };
        const manager = new PendingEventNotificationManager({
            emailHelper,
            logger,
            templateManager: new EmailTemplateManager(),
            userModel,
            webBaseUrl: 'https://event-hub.test',
        });

        const result = await manager.notifyPendingApproval({
            event: buildEvent({
                title: 'Semana Acadêmica',
                description: 'Trilha de oficinas e palestras.',
                date: '2026-06-11T19:00:00.000Z',
            }),
            organizer: buildUser({ id: 'user-9', name: 'Ada Lovelace' }),
        });

        expect(emailHelper.send).toHaveBeenCalledTimes(3);
        expect(emailHelper.send.mock.calls.map((call) => call[0])).toEqual([
            ['admin@example.com'],
            ['grace@example.com'],
            ['linus@example.com'],
        ]);
        expect(logger.error).toHaveBeenCalledWith('Pending-event notification failed for admin@example.com:', deliveryError);
        expect(logger.info).toHaveBeenCalledWith('Pending-event notification sent to 2 admin recipient(s) with 1 failure(s).');
        expect(result).toEqual({
            deliveries: [
                {
                    email: 'grace@example.com',
                    messageId: 'msg:grace@example.com',
                },
                {
                    email: 'linus@example.com',
                    messageId: 'msg:linus@example.com',
                },
            ],
            failures: [
                {
                    email: 'admin@example.com',
                    message: 'smtp timeout',
                },
            ],
            failedCount: 1,
            recipientCount: 3,
            sentCount: 2,
        });
    });

    test('renderPendingApprovalEmail escapes event fields while preserving the MJML section layout', () => {
        const manager = new PendingEventNotificationManager({
            emailHelper: { send: jest.fn() },
            templateManager: new EmailTemplateManager(),
            userModel: { listEmailPreferenceRecipients: jest.fn(async () => []) },
            webBaseUrl: 'https://event-hub.test',
        });

        const message = manager.renderPendingApprovalEmail(buildUser({ name: 'Grace <admin>' }), {
            event: buildEvent({
                title: '<script>alert(1)</script>',
                description: 'Linha 1 <b>forte</b>',
                date: '2026-06-11T19:00:00.000Z',
                location: 'Lab <B>',
                categoryLabel: 'Acadêmico <x>',
            }),
            organizer: buildUser({ name: 'Ada <script>' }),
        });

        expect(message.subject).toBe('Event Hub - Novo evento aguardando moderação');
        expect(message.content).toContain('Olá Grace &lt;admin&gt;,');
        expect(message.content).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(message.content).toContain('Linha 1 &lt;b&gt;forte&lt;/b&gt;');
        expect(message.content).toContain('Ada &lt;script&gt;');
        expect(message.content).toContain('Acadêmico &lt;x&gt;');
        expect(message.content).not.toContain('&lt;mj-section');
        expect(message.content).toContain('<mj-section');
    });

    test('renderPendingApprovalEmail falls back to default recipient, unavailable values, and normalized dashboard URL', () => {
        const manager = new PendingEventNotificationManager({
            emailHelper: { send: jest.fn() },
            templateManager: new EmailTemplateManager(),
            userModel: { listEmailPreferenceRecipients: jest.fn(async () => []) },
            webBaseUrl: 'https://event-hub.test///',
        });

        const message = manager.renderPendingApprovalEmail({}, {
            event: buildEvent({
                title: '',
                description: '',
                date: 'not-a-date',
                location: '',
                categoryLabel: '',
                organizerName: 'Linus Torvalds',
            }),
        });

        expect(message.content).toContain('Olá admin,');
        expect(message.content).toContain('Linus Torvalds');
        expect(message.content).toContain('Data a definir');
        expect(message.content).toContain('Não informado');
        expect(message.content).toContain('https://event-hub.test/dashboard');
    });
});