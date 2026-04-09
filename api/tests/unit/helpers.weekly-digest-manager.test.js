import { describe, expect, jest, test } from '@jest/globals';
import { EmailTemplateManager } from '../../helpers/email-template-manager.js';
import { WeeklyDigestManager } from '../../background/weekly-digest-manager.js';
import { buildEvent, buildUser } from './support/fixtures.js';

describe('helpers/weekly-digest-manager', () => {
    test('getCurrentWeekDigest renders the same Sunday-to-Saturday window used by the week page', async () => {
        const eventModel = {
            listCurrentWeek: jest.fn(async () => ([
                buildEvent({
                    title: 'Semana Acadêmica de Robótica',
                    description: 'Oficinas, painéis e demonstrações abertas.',
                    date: '2026-04-08T19:30:00.000Z',
                    status: 'published',
                    location: 'Laboratório Maker',
                    organizerName: 'Equipe de Extensão',
                    calendarLink: 'https://calendar.google.com/calendar/event?eid=robotica',
                }),
            ])),
        };
        const manager = new WeeklyDigestManager({
            emailHelper: { send: jest.fn() },
            eventModel,
            templateManager: new EmailTemplateManager(),
            userModel: { list: jest.fn(async () => []) },
            webBaseUrl: 'https://agenda-ch.test',
        });
        const referenceDate = new Date(2026, 3, 6, 9, 0, 0, 0);

        const digest = await manager.getCurrentWeekDigest(referenceDate);
        const message = manager.renderDigestEmail(buildUser(), digest);

        expect(eventModel.listCurrentWeek).toHaveBeenCalledWith(referenceDate);
        expect(digest.weekRange).toEqual({
            from: '2026-04-05',
            to: '2026-04-11',
        });
        expect(digest.weekRangeLabel).toBe('5 de abril de 2026 a 11 de abril de 2026');
        expect(message.subject).toBe('Agenda da semana · 5 de abril de 2026 a 11 de abril de 2026');
        expect(message.content).toContain('Semana Acadêmica de Robótica');
        expect(message.content).toContain('Oficinas, painéis e demonstrações abertas.');
        expect(message.content).toContain('Equipe de Extensão');
        expect(message.content).toContain('Laboratório Maker');
        expect(message.content).toContain('Abrir página da agenda');
        expect(message.content).toContain('https://agenda-ch.test/week');
    });

    test('sendCurrentWeekDigest sends one message per persisted user email address with no hidden audience fallback', async () => {
        const emailHelper = {
            send: jest.fn(async ([email]) => ({
                messageId: `msg:${email}`,
            })),
        };
        const userModel = {
            list: jest.fn(async () => ([
                buildUser({ email: 'ADA@example.com' }),
                buildUser({ id: 'user-2', name: 'Grace Hopper', email: 'grace@example.com' }),
                buildUser({ id: 'user-3', name: 'Ada Duplicada', email: 'ada@example.com' }),
                buildUser({ id: 'user-4', name: 'Sem email', email: '   ' }),
            ])),
        };
        const manager = new WeeklyDigestManager({
            emailHelper,
            eventModel: {
                listCurrentWeek: jest.fn(async () => ([
                    buildEvent({
                        title: 'Feira de Ciências',
                        status: 'published',
                    }),
                ])),
            },
            templateManager: new EmailTemplateManager(),
            userModel,
        });

        const result = await manager.sendCurrentWeekDigest(new Date(2026, 3, 7, 18, 0, 0, 0));

        expect(userModel.list).toHaveBeenCalledWith({
            view: ['id', 'name', 'email'],
        });
        expect(emailHelper.send).toHaveBeenCalledTimes(2);
        expect(emailHelper.send.mock.calls.map((call) => call[0])).toEqual([
            ['ada@example.com'],
            ['grace@example.com'],
        ]);
        expect(result).toMatchObject({
            eventCount: 1,
            recipientCount: 2,
            sentCount: 2,
        });
    });

    test('renderDigestEmail escapes plain text fields while preserving intended MJML fragments', async () => {
        const manager = new WeeklyDigestManager({
            emailHelper: { send: jest.fn() },
            eventModel: { listCurrentWeek: jest.fn(async () => []) },
            templateManager: new EmailTemplateManager(),
            userModel: { list: jest.fn(async () => []) },
            webBaseUrl: 'https://agenda-ch.test',
        });
        const digest = {
            actionUrl: 'https://agenda-ch.test/week',
            events: [
                buildEvent({
                    title: '<script>alert(1)</script>',
                    description: 'Linha 1\n<script>alert(2)</script>',
                    date: '2026-04-08T19:30:00.000Z',
                    category: 'Extensão <x>',
                    location: 'Lab <B>',
                    organizerName: 'Equipe <script>',
                    calendarLink: 'https://calendar.google.com/calendar/event?eid=<bad>',
                }),
            ],
            strings: {
                ...new EmailTemplateManager().loadJsonTemplate('weekly-digest-email'),
                brandName: 'Campus <Hub>',
                eyebrowText: 'Boletim <semanal>',
                weekRangeTitle: 'Faixa <da semana>',
                eventCardLabel: 'Destaque <evento>',
            },
            weekRange: {
                from: '2026-04-05',
                to: '2026-04-11',
            },
            weekRangeLabel: '5 de abril <2026> a 11 de abril de 2026',
        };

        const message = manager.renderDigestEmail(buildUser({ name: 'Ada <script>' }), digest);

        expect(message.subject).toBe('Agenda da semana · 5 de abril <2026> a 11 de abril de 2026');
        expect(message.content).toContain('Olá Professores,');
        expect(message.content).toContain('Campus &lt;Hub&gt;');
        expect(message.content).toContain('Boletim &lt;semanal&gt;');
        expect(message.content).toContain('5 de abril &lt;2026&gt; a 11 de abril de 2026');
        expect(message.content).toContain('Destaque &lt;evento&gt;');
        expect(message.content).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(message.content).toContain('Linha 1');
        expect(message.content).toContain('&lt;script&gt;alert(2)&lt;/script&gt;');
        expect(message.content).toContain('Extensão &lt;x&gt;');
        expect(message.content).toContain('Equipe &lt;script&gt;');
        expect(message.content).toContain('Mensagem automática da AgendaCharq.');
        expect(message.content).not.toContain('&lt;mj-section');
        expect(message.content).toContain('<mj-section');
    });

    test('manual digest runs append the update timestamp to the subject and summary payload', async () => {
        const emailHelper = {
            send: jest.fn(async () => ({
                messageId: 'msg:manual',
            })),
        };
        const manager = new WeeklyDigestManager({
            emailHelper,
            eventModel: {
                listCurrentWeek: jest.fn(async () => ([
                    buildEvent({
                        title: 'Plantão de Projetos',
                        status: 'published',
                    }),
                ])),
            },
            templateManager: new EmailTemplateManager(),
            userModel: {
                list: jest.fn(async () => ([
                    buildUser({ email: 'docente@ifsul.edu.br' }),
                ])),
            },
        });
        const referenceDate = new Date(2026, 3, 7, 18, 0, 0, 0);
        const manualTriggeredAt = new Date(2026, 3, 9, 15, 45, 0, 0);

        const digest = await manager.getCurrentWeekDigest(referenceDate, { manualTriggeredAt });
        const message = manager.renderDigestEmail(buildUser(), digest);
        const result = await manager.sendCurrentWeekDigest(referenceDate, { manualTriggeredAt });

        expect(digest.manualTriggeredAt).toBe(manualTriggeredAt.toISOString());
        expect(digest.manualTriggeredAtLabel).toBeTruthy();
        expect(message.subject).toContain(`Agenda atualizada em ${digest.manualTriggeredAtLabel}`);
        expect(emailHelper.send).toHaveBeenCalledWith(
            ['docente@ifsul.edu.br'],
            message.subject,
            expect.any(String),
        );
        expect(result).toMatchObject({
            manualTriggeredAt: manualTriggeredAt.toISOString(),
            manualTriggeredAtLabel: digest.manualTriggeredAtLabel,
            recipientCount: 1,
            sentCount: 1,
        });
    });
});