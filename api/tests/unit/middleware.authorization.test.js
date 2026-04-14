import { describe, expect, jest, test } from '@jest/globals';
import {
    assertPasswordResettableUser,
    assertPromotableUser,
    requireAdminUser,
} from '../../middleware/authorization.js';

describe('middleware/authorization', () => {
    test('requireAdminUser accepts administrators from req.user', () => {
        const next = jest.fn();

        requireAdminUser({ user: { id: 'admin-1', role: 'admin' } }, {}, next);

        expect(next).toHaveBeenCalledWith();
    });

    test('requireAdminUser prefers req.currentUser when available', () => {
        const next = jest.fn();

        requireAdminUser({
            currentUser: { id: 'admin-1', role: 'admin' },
            user: { id: 'member-1', role: 'member' },
        }, {}, next);

        expect(next).toHaveBeenCalledWith();
    });

    test('requireAdminUser rejects non-admin actors', () => {
        const next = jest.fn();

        requireAdminUser({ user: { id: 'member-1', role: 'member' } }, {}, next);

        expect(next.mock.calls[0][0].status).toBe(403);
        expect(next.mock.calls[0][0].message).toBe('Acesso restrito a administradores.');
    });

    test('assertPromotableUser requires an existing target user', () => {
        expect(() => assertPromotableUser(null, { id: 'admin-1' })).toThrow('Usuário não encontrado.');
    });

    test('assertPromotableUser rejects self-promotion', () => {
        expect(() => assertPromotableUser({ id: 'admin-1', role: 'member' }, { id: 'admin-1' })).toThrow('Você não pode promover a própria conta.');
    });

    test('assertPromotableUser rejects targets that are already administrators', () => {
        expect(() => assertPromotableUser({ id: 'member-1', role: 'ADMIN' }, { id: 'admin-1' })).toThrow('Este usuário já é administrador.');
    });

    test('assertPromotableUser accepts member targets', () => {
        expect(() => assertPromotableUser({ id: 'member-1', role: 'member' }, { id: 'admin-1' })).not.toThrow();
    });

    test('assertPasswordResettableUser requires an existing target user', () => {
        expect(() => assertPasswordResettableUser(null)).toThrow('Usuário não encontrado.');
    });

    test('assertPasswordResettableUser rejects administrator accounts', () => {
        expect(() => assertPasswordResettableUser({ id: 'admin-1', role: 'ADMIN' })).toThrow('Administradores não podem ser redefinidos por este fluxo.');
    });

    test('assertPasswordResettableUser accepts member accounts', () => {
        expect(() => assertPasswordResettableUser({ id: 'member-1', role: 'member' })).not.toThrow();
    });
});