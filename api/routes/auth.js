import express from 'express';
import { User } from '../model/user.js';
import { signToken } from '../helpers/token.js';
import { authMiddleware } from '../middleware/auth.js';
import {
    assertPasswordResettableUser,
    assertPromotableUser,
    requireAdminUser,
} from '../middleware/authorization.js';
import { HttpError } from '../helpers/error.js';
import { sendCreated, sendSuccess } from '../helpers/response.js';

export const router = express.Router();

/**
 * Returns the public user shape exposed by auth responses.
 */
function publicUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
    };
}

/**
 * Validates the password change request payload.
 */
function parsePasswordChangePayload(payload = {}) {
    const currentPassword = typeof payload.currentPassword === 'string'
        ? payload.currentPassword
        : '';
    const newPassword = typeof payload.newPassword === 'string'
        ? payload.newPassword
        : '';

    if (!currentPassword || !newPassword) {
        throw new HttpError(400, 'Informe a senha atual e a nova senha.');
    }

    if (currentPassword === newPassword) {
        throw new HttpError(400, 'A nova senha deve ser diferente da senha atual.');
    }

    return { currentPassword, newPassword };
}

/**
 * Validates the authenticated profile update payload.
 */
function parseProfileUpdatePayload(payload = {}) {
    const name = typeof payload.name === 'string'
        ? payload.name.trim()
        : '';
    const email = typeof payload.email === 'string'
        ? payload.email.trim().toLowerCase()
        : '';

    if (!name || !email) {
        throw new HttpError(400, 'Informe nome e e-mail.');
    }

    return { name, email };
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
 * Creates a JWT payload for an authenticated user.
 */
function createSessionToken(user) {
    return signToken({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
    });
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
 * Handles account creation and returns the initial session token.
 */
router.post('/register', async (req, res, next) => {
    try {
        const { name, email, password } = req.body || {};

        if (!name || !email || !password) {
            throw new HttpError(400, 'Nome, e-mail e senha são obrigatórios.');
        }

        const existing = await User.findByEmail(email);
        if (existing) {
            throw new HttpError(409, 'Já existe uma conta com este e-mail.');
        }

        const user = await User.create({
            name,
            email,
            password,
        });

        const token = createSessionToken(user);
        return sendCreated(res, {
            data: { user: publicUser(user), token },
        });
    } catch (err) {
        return next(err instanceof HttpError ? err : new HttpError(500, 'Não foi possível criar a conta.', err));
    }
});

/**
 * Authenticates an existing account and returns the session token.
 */
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            throw new HttpError(400, 'Informe e-mail e senha.');
        }

        const stored = await User.findByEmail(email);
        if (!stored) {
            throw new HttpError(401, 'Credenciais inválidas.');
        }

        const user = new User(stored);
        if (!user.validatePassword(password)) {
            throw new HttpError(401, 'Credenciais inválidas.');
        }

        const token = createSessionToken(user);
        return sendSuccess(res, {
            data: { user: publicUser(user), token },
        });
    } catch (err) {
        return next(err instanceof HttpError ? err : new HttpError(500, 'Não foi possível processar a autenticação.', err));
    }
});

/**
 * Returns the authenticated user's current session payload.
 */
router.get('/me', authMiddleware, async (req, res, next) => {
    try {
        const currentUser = await loadAuthenticatedUser(req.user.id);

        return sendSuccess(res, {
            data: { user: publicUser(currentUser) },
        });
    } catch (err) {
        return next(err instanceof HttpError ? err : new HttpError(500, 'Não foi possível validar a sessão.', err));
    }
});

/**
 * Updates the authenticated user's profile and refreshes the session token.
 */
router.put('/me',
    authMiddleware,
    async (req, res, next) => {
    try {
        const currentUser = await loadAuthenticatedUser(req.user.id);
        const { name, email } = parseProfileUpdatePayload(req.body);
        const existingUser = await User.findByEmail(email);

        if (existingUser && existingUser.id !== currentUser.id) {
            throw new HttpError(409, 'Já existe uma conta com este e-mail.');
        }

        const updatedUser = await User.updateProfile(currentUser.id, { name, email });
        const token = createSessionToken(updatedUser);
        return sendSuccess(res, {
            data: { user: publicUser(updatedUser), token },
            message: 'Perfil atualizado.',
        });
    } catch (err) {
        return next(err instanceof HttpError ? err : new HttpError(500, 'Não foi possível atualizar o perfil.', err));
    }
});

/**
 * Changes the authenticated user's password after validating the current password.
 */
router.put('/password',
    authMiddleware,
    async (req, res, next) => {
    try {
        const currentUser = await loadAuthenticatedUser(req.user.id);
        const { currentPassword, newPassword } = parsePasswordChangePayload(req.body);
        const user = new User(currentUser);

        if (!user.validatePassword(currentPassword)) {
            throw new HttpError(401, 'A senha atual está incorreta.');
        }

        const updatedUser = await User.updatePassword(currentUser.id, newPassword);
        return sendSuccess(res, {
            data: { user: publicUser(updatedUser) },
            message: 'Senha atualizada.',
        });
    } catch (err) {
        return next(err instanceof HttpError ? err : new HttpError(500, 'Não foi possível atualizar a senha.', err));
    }
});

/**
 * Resets a member password through the administrator tooling.
 */
router.put('/users/password/reset',
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
router.get('/users', 
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
router.put('/users/:id/promote', 
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
