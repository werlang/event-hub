import { describe, expect, test } from '@jest/globals';
import {
    assertAdminCanModerateEvent,
    assertOwnerCanDeleteEvent,
    assertOwnerCanEditEvent,
    assertOwnerCanManageEvent,
} from '../../middleware/event-authorization.js';
import { buildEvent, buildUser } from './support/fixtures.js';

describe('middleware/event-authorization', () => {
    test('assertOwnerCanEditEvent requires an existing event', () => {
        expect(() => assertOwnerCanEditEvent(null, buildUser())).toThrow('Evento não encontrado.');
    });

    test('assertOwnerCanEditEvent rejects non-owners', () => {
        expect(() => assertOwnerCanEditEvent(buildEvent({ organizerId: 'user-2' }), buildUser({ id: 'user-1' }))).toThrow('Você não tem permissão para gerenciar este evento.');
    });

    test('assertOwnerCanEditEvent rejects published events for owners', () => {
        expect(() => assertOwnerCanEditEvent(buildEvent({ status: 'published' }), buildUser())).toThrow('Somente eventos pendentes ou rejeitados podem ser editados.');
    });

    test('assertOwnerCanEditEvent accepts pending and rejected owner events', () => {
        expect(() => assertOwnerCanEditEvent(buildEvent({ status: 'pending' }), buildUser())).not.toThrow();
        expect(() => assertOwnerCanEditEvent(buildEvent({ status: 'rejected' }), buildUser())).not.toThrow();
    });

    test('assertOwnerCanDeleteEvent rejects published events for owners', () => {
        expect(() => assertOwnerCanDeleteEvent(buildEvent({ status: 'published' }), buildUser())).toThrow('Somente eventos pendentes ou rejeitados podem ser excluídos.');
    });

    test('assertOwnerCanDeleteEvent accepts pending and rejected owner events', () => {
        expect(() => assertOwnerCanDeleteEvent(buildEvent({ status: 'pending' }), buildUser())).not.toThrow();
        expect(() => assertOwnerCanDeleteEvent(buildEvent({ status: 'rejected' }), buildUser())).not.toThrow();
    });

    test('assertOwnerCanManageEvent follows the delete permission contract', () => {
        expect(() => assertOwnerCanManageEvent(buildEvent({ status: 'rejected' }), buildUser())).not.toThrow();
        expect(() => assertOwnerCanManageEvent(buildEvent({ status: 'published' }), buildUser())).toThrow('Somente eventos pendentes ou rejeitados podem ser excluídos.');
    });

    test('assertAdminCanModerateEvent requires an existing event', () => {
        expect(() => assertAdminCanModerateEvent(null, buildUser({ id: 'admin-1', role: 'admin' }))).toThrow('Evento não encontrado.');
    });

    test('assertAdminCanModerateEvent blocks self moderation by default', () => {
        expect(() => assertAdminCanModerateEvent(buildEvent({ organizerId: 'admin-1', status: 'pending' }), buildUser({ id: 'admin-1', role: 'admin' }))).toThrow('Administradores não podem moderar os próprios eventos.');
    });

    test('assertAdminCanModerateEvent allows self moderation when explicitly enabled', () => {
        expect(() => assertAdminCanModerateEvent(
            buildEvent({ organizerId: 'admin-1', status: 'pending' }),
            buildUser({ id: 'admin-1', role: 'admin' }),
            { allowSelfModeration: true },
        )).not.toThrow();
    });

    test('assertAdminCanModerateEvent rejects already published events', () => {
        expect(() => assertAdminCanModerateEvent(buildEvent({ status: 'published', organizerId: 'user-1' }), buildUser({ id: 'admin-1', role: 'admin' }))).toThrow('Somente eventos pendentes podem ser moderados.');
    });

    test('assertAdminCanModerateEvent accepts pending events from other organizers only', () => {
        expect(() => assertAdminCanModerateEvent(buildEvent({ status: 'pending', organizerId: 'user-2' }), buildUser({ id: 'admin-1', role: 'admin' }))).not.toThrow();
        expect(() => assertAdminCanModerateEvent(buildEvent({ status: 'rejected', organizerId: 'user-2' }), buildUser({ id: 'admin-1', role: 'admin' }))).toThrow('Somente eventos pendentes podem ser moderados.');
    });
});