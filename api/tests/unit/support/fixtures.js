import { normalizeEventCategoryId, readEventCategoryLabel } from '../../../helpers/event-category.js';

/**
 * Builds a normalized user fixture for model and route tests.
 */
export function buildUser(overrides = {}) {
    return {
        id: 'user-1',
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        role: 'member',
        emailPreferences: {
            eventUpdates: true,
            adminPendingRequests: true,
        },
        passwordHash: 'hashed-password',
        createdAt: '2026-04-02T12:00:00.000Z',
        ...overrides,
    };
}

/**
 * Builds a normalized event fixture for model and route tests.
 */
export function buildEvent(overrides = {}) {
    const category = normalizeEventCategoryId(overrides.category ?? 'academico', { fallback: 'outro' });
    return {
        id: 'event-1',
        title: 'Semana da Computacao',
        description: 'Palestras e oficinas para a comunidade academica.',
        date: '2026-05-20T18:00:00.000Z',
        category,
        categoryLabel: readEventCategoryLabel(overrides.category ?? category, { fallback: 'Outro' }),
        location: 'Auditorio Central',
        status: 'pending',
        rejectionReason: null,
        calendarLink: null,
        calendarEventId: null,
        organizerId: 'user-1',
        organizerName: 'Ada Lovelace',
        createdAt: '2026-04-02T12:00:00.000Z',
        ...overrides,
    };
}