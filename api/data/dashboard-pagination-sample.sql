-- Sample account and 12 events to demonstrate dashboard pagination.
-- Login: membro.paginacao@example.com
-- Password: senha123456

INSERT INTO users (id, name, email, role, password_hash, email_weekly_enabled, email_event_updates_enabled, email_admin_pending_requests_enabled, created_at)
VALUES (
    '11111111-1111-4111-8111-111111111111',
    'Membro Paginação',
    'membro.paginacao@example.com',
    'member',
    '$2b$12$br.eY08/507owLT7Cl8YveewKYtXMHkZB5l4RWbmNmmPgzuh3dvjS',
    1,
    1,
    1,
    '2026-04-02 12:00:00'
)
ON DUPLICATE KEY UPDATE
    name = VALUES(name),
    role = VALUES(role),
    password_hash = VALUES(password_hash),
    email_weekly_enabled = VALUES(email_weekly_enabled),
    email_event_updates_enabled = VALUES(email_event_updates_enabled),
    email_admin_pending_requests_enabled = VALUES(email_admin_pending_requests_enabled);

INSERT INTO events (id, title, description, date, category, location, status, calendar_link, calendar_event_id, organizer_id, created_at)
VALUES
    ('20000000-0000-4000-8000-000000000001', 'Semana de Integração 2026', 'Acolhida para novos estudantes com apresentações de laboratórios e projetos.', '2026-05-03 18:30:00', 'academico', 'Auditório Central', 'published', NULL, NULL, '11111111-1111-4111-8111-111111111111', '2026-04-02 12:10:00'),
    ('20000000-0000-4000-8000-000000000002', 'Oficina de Robótica Aplicada', 'Montagem de protótipos com foco em automação e sensores.', '2026-05-10 14:00:00', 'extensao', 'Laboratório Maker', 'pending', NULL, NULL, '11111111-1111-4111-8111-111111111111', '2026-04-02 12:11:00'),
    ('20000000-0000-4000-8000-000000000003', 'Feira de Projetos Integradores', 'Exposição dos trabalhos finais das turmas técnicas.', '2026-05-17 19:00:00', 'academico', 'Pátio Coberto', 'published', NULL, NULL, '11111111-1111-4111-8111-111111111111', '2026-04-02 12:12:00'),
    ('20000000-0000-4000-8000-000000000004', 'Roda de Conversa sobre Estágio', 'Encontro com dicas práticas sobre currículo, entrevista e rotina profissional.', '2026-05-24 16:00:00', 'representacao', 'Sala 204', 'rejected', NULL, NULL, '11111111-1111-4111-8111-111111111111', '2026-04-02 12:13:00'),
    ('20000000-0000-4000-8000-000000000005', 'Mostra Cultural do Campus', 'Apresentações artísticas com estudantes e comunidade externa.', '2026-05-28 20:00:00', 'outro', 'Ginásio', 'pending', NULL, NULL, '11111111-1111-4111-8111-111111111111', '2026-04-02 12:14:00'),
    ('20000000-0000-4000-8000-000000000006', 'Seminário de Pesquisa em Dados', 'Painéis rápidos sobre iniciação científica e análise de dados.', '2026-06-02 18:45:00', 'academico', 'Sala Multiuso', 'published', NULL, NULL, '11111111-1111-4111-8111-111111111111', '2026-04-02 12:15:00'),
    ('20000000-0000-4000-8000-000000000007', 'Mutirão Solidário de Inverno', 'Campanha de arrecadação com organização de equipes e postos de coleta.', '2026-06-08 09:00:00', 'extensao', 'Hall de Entrada', 'published', NULL, NULL, '11111111-1111-4111-8111-111111111111', '2026-04-02 12:16:00'),
    ('20000000-0000-4000-8000-000000000008', 'Encontro do Grêmio Estudantil', 'Debate aberto sobre calendário letivo, eventos e demandas da turma.', '2026-06-13 17:30:00', 'reuniao', 'Sala do Grêmio', 'pending', NULL, NULL, '11111111-1111-4111-8111-111111111111', '2026-04-02 12:17:00'),
    ('20000000-0000-4000-8000-000000000009', 'Palestra: Segurança na Internet', 'Boas práticas de privacidade, senhas e prevenção de golpes digitais.', '2026-06-19 19:15:00', 'academico', 'Auditório Central', 'published', NULL, NULL, '11111111-1111-4111-8111-111111111111', '2026-04-02 12:18:00'),
    ('20000000-0000-4000-8000-000000000010', 'Circuito de Extensão em Comunidade', 'Ações integradas com oficinas e atendimento em parceria com o bairro.', '2026-06-24 13:30:00', 'extensao', 'Praça da Biblioteca', 'pending', NULL, NULL, '11111111-1111-4111-8111-111111111111', '2026-04-02 12:19:00'),
    ('20000000-0000-4000-8000-000000000011', 'Mesa Redonda sobre Liderança', 'Conversa com representantes de turma e coordenações sobre organização estudantil.', '2026-07-01 18:00:00', 'representacao', 'Sala 301', 'rejected', NULL, NULL, '11111111-1111-4111-8111-111111111111', '2026-04-02 12:20:00'),
    ('20000000-0000-4000-8000-000000000012', 'Fechamento do Semestre com Mostra', 'Apresentação final de resultados, relatos e próximos passos do semestre.', '2026-07-08 18:30:00', 'outro', 'Auditório Central', 'published', NULL, NULL, '11111111-1111-4111-8111-111111111111', '2026-04-02 12:21:00')
ON DUPLICATE KEY UPDATE
    title = VALUES(title),
    description = VALUES(description),
    date = VALUES(date),
    category = VALUES(category),
    location = VALUES(location),
    status = VALUES(status),
    calendar_link = VALUES(calendar_link),
    calendar_event_id = VALUES(calendar_event_id),
    organizer_id = VALUES(organizer_id);