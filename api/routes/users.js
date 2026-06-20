import express from 'express';
import { HttpError } from '../helpers/error.js';
import { PasswordResetEmailManager } from '../helpers/password-reset-email-manager.js';
import { sendSuccess } from '../helpers/response.js';
import { authMiddleware } from '../middleware/auth.js';
import {
    assertPasswordResettableUser,
    assertPromotableUser,
    requireAdminUser,
} from '../middleware/authorization.js';
import { PasswordResetToken } from '../model/password-reset-token.js';
import { User } from '../model/user.js';

const PASSWORD_RESET_REQUEST_MESSAGE = 'Se o e-mail estiver cadastrado, enviaremos um link para redefinir a senha.';

export const router = express.Router();

/**
 * Returns the public user shape exposed by user-management responses.
 */
function publicUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailPreferences: User.normalizeEmailPreferences(user?.emailPreferences || user),
    };
}

/**
 * Loads the current authenticated account and rejects expired sessions.
 */
async function loadAuthenticatedUser(userId) {
    const storedUser = await User.findById(userId);
    if (!storedUser) {
        throw new HttpError(401, 'Sessão expirada.');
    }

    return storedUser;
}

/**
 * Validates the administrator password reset payload.
 */
function parseAdminPasswordResetPayload(payload = {}) {
    const email = typeof payload.email === 'string'
        ? payload.email.trim().toLowerCase()
        : '';
    const newPassword = typeof payload.newPassword === 'string'
        ? payload.newPassword
        : '';

    if (!email || !newPassword) {
        throw new HttpError(400, 'Informe o e-mail do usuário e a nova senha.');
    }

    return { email, newPassword };
}

/**
 * Validates the public reset-request payload.
 */
function parsePasswordResetRequestPayload(payload = {}) {
    const email = typeof payload.email === 'string'
        ? payload.email.trim().toLowerCase()
        : '';

    if (!email) {
        throw new HttpError(400, 'Informe o e-mail da conta.');
    }

    return { email };
}

/**
 * Validates the public reset-confirmation payload.
 */
function parsePasswordResetConfirmationPayload(payload = {}) {
    const token = typeof payload.token === 'string'
        ? payload.token.trim()
        : '';
    const newPassword = typeof payload.newPassword === 'string'
        ? payload.newPassword
        : '';

    if (!token || !newPassword) {
        throw new HttpError(400, 'Informe o link de redefinição e a nova senha.');
    }

    return { token, newPassword };
}

/**
 * Creates a reset token and sends the reset e-mail when the account exists.
 */
router.post('/password-reset', async (req, res, next) => {
    try {
        const { email } = parsePasswordResetRequestPayload(req.body);
        const user = await User.findByEmail(email);

        // Return the same public response even when the account is unknown.
        if (user) {
            const resetToken = await PasswordResetToken.createForUser(user.id);
            const mailer = new PasswordResetEmailManager();
            await mailer.sendPasswordResetEmail(user, resetToken.token);
        }

        return sendSuccess(res, {
            message: PASSWORD_RESET_REQUEST_MESSAGE,
        });
    } catch (err) {
        return next(err instanceof HttpError ? err : new HttpError(500, 'Não foi possível solicitar a redefinição de senha.', err));
    }
});

/**
 * Consumes a valid one-time token and stores the new password.
 */
router.put('/password-reset', async (req, res, next) => {
    try {
        const { token, newPassword } = parsePasswordResetConfirmationPayload(req.body);
        const resetToken = await PasswordResetToken.findUsableByToken(token);

        if (!resetToken) {
            throw new HttpError(400, 'Link de redefinição inválido ou expirado.');
        }

        const user = await User.findById(resetToken.userId);
        if (!user) {
            throw new HttpError(400, 'Link de redefinição inválido ou expirado.');
        }

        await User.updatePassword(user.id, newPassword);
        await PasswordResetToken.invalidateActiveForUser(user.id);

        return sendSuccess(res, {
            message: 'Senha redefinida. Você já pode entrar com a nova senha.',
        });
    } catch (err) {
        return next(err instanceof HttpError ? err : new HttpError(500, 'Não foi possível redefinir a senha.', err));
    }
});

/**
 * Resets a member password through the administrator tooling.
 */
router.put('/password/reset',
    authMiddleware,
    requireAdminUser,
    async (req, res, next) => {
    try {
        await loadAuthenticatedUser(req.user.id);
        const { email, newPassword } = parseAdminPasswordResetPayload(req.body);
        const targetUser = await User.findByEmail(email);

        assertPasswordResettableUser(targetUser);

        const updatedUser = await User.updatePassword(targetUser.id, newPassword);
        return sendSuccess(res, {
            data: { user: publicUser(updatedUser) },
            message: 'Senha do usuário atualizada.',
        });
    } catch (err) {
        return next(err instanceof HttpError ? err : new HttpError(500, 'Não foi possível redefinir a senha do usuário.', err));
    }
});

/**
 * Lists safe user records for administrator dashboard tools.
 */
router.get('/',
    authMiddleware,
    requireAdminUser,
    async (req, res, next) => {
    try {
        const currentUser = await loadAuthenticatedUser(req.user.id);
        const users = await User.listForAdministration({ excludeId: currentUser.id });
        return sendSuccess(res, {
            data: { users: users.map(publicUser) },
        });
    } catch (err) {
        return next(err instanceof HttpError ? err : new HttpError(500, 'Não foi possível carregar os usuários.', err));
    }
});

/**
 * Promotes a member account to administrator.
 */
router.put('/:id/promote',
    authMiddleware,
    requireAdminUser,
    async (req, res, next) => {
    try {
        const currentUser = await loadAuthenticatedUser(req.user.id);
        const targetUser = await User.findById(req.params.id);

        assertPromotableUser(targetUser, currentUser);

        const updatedUser = await User.promoteToAdmin(targetUser.id);
        return sendSuccess(res, {
            data: { user: publicUser(updatedUser) },
            message: 'Usuário promovido a administrador.',
        });
    } catch (err) {
        return next(err instanceof HttpError ? err : new HttpError(500, 'Não foi possível promover o usuário.', err));
    }
});
