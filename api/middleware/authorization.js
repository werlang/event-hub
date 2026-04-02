import { HttpError } from '../helpers/error.js';
import { User } from '../model/user.js';

/**
 * Ensures the current authenticated account has administrator privileges.
 */
export function requireAdminUser(req, res, next) {
    const actor = req.currentUser || req.user;
    if (actor?.role !== 'admin') {
        return next(new HttpError(403, 'Acesso restrito a administradores.'));
    }

    return next();
}

/**
 * Ensures the requested account can be promoted by the current administrator.
 */
export function assertPromotableUser(user, actor) {
    if (!user) {
        throw new HttpError(404, 'Usuário não encontrado.');
    }

    if (user.id === actor?.id) {
        throw new HttpError(403, 'Você não pode promover a própria conta.');
    }

    if (User.normalizeRole(user.role) === 'admin') {
        throw new HttpError(400, 'Este usuário já é administrador.');
    }
}