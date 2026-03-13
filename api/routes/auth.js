import express from 'express';
import { User } from '../model/user.js';
import { signToken } from '../helpers/token.js';
import { authMiddleware } from '../middleware/auth.js';
import { CustomError } from '../helpers/error.js';
import { sendCreated, sendSuccess } from '../helpers/response.js';

export const router = express.Router();

/**
 * Re-throws unknown failures as normalized API errors.
 */
function rethrowAsApiError(error, fallbackMessage) {
    if (error instanceof CustomError || Number.isInteger(error?.status)) {
        throw error;
    }

    throw new CustomError(500, fallbackMessage, {
        detail: error?.message || String(error),
    }, error);
}

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
 * Loads the current authenticated account and rejects expired sessions.
 */
async function requireStoredUser(userId) {
    const stored = await User.findById(userId);
    if (!stored) {
        throw new CustomError(401, 'Sessão expirada.');
    }

    return stored;
}

/**
 * Ensures the current authenticated account has administrator privileges.
 */
function requireAdminUser(user) {
    if (user?.role !== 'admin') {
        throw new CustomError(403, 'Acesso restrito a administradores.');
    }
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
        throw new CustomError(400, 'Informe a senha atual e a nova senha.');
    }

    if (currentPassword === newPassword) {
        throw new CustomError(400, 'A nova senha deve ser diferente da senha atual.');
    }

    return { currentPassword, newPassword };
}

/**
 * Ensures the requested account can be promoted by the current administrator.
 */
function ensurePromotableUser(user, actorId) {
    if (!user) {
        throw new CustomError(404, 'Usuário não encontrado.');
    }

    if (user.id === actorId) {
        throw new CustomError(403, 'Você não pode promover a própria conta.');
    }

    if (User.normalizeRole(user.role) === 'admin') {
        throw new CustomError(400, 'Este usuário já é administrador.');
    }
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
 * Handles account creation and returns the initial session token.
 */
router.post('/register', async (req, res, next) => {
    try {
        const { name, email, password } = req.body || {};

        if (!name || !email || !password) {
            throw new CustomError(400, 'Nome, e-mail e senha são obrigatórios.');
        }

        const existing = await User.findByEmail(email);
        if (existing) {
            throw new CustomError(409, 'Já existe uma conta com este e-mail.');
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
        try {
            rethrowAsApiError(err, 'Não foi possível concluir o registro.');
        } catch (error) {
            return next(error);
        }
    }
});

/**
 * Authenticates an existing account and returns the session token.
 */
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            throw new CustomError(400, 'Informe e-mail e senha.');
        }

        const stored = await User.findByEmail(email);
        if (!stored) {
            throw new CustomError(401, 'Credenciais inválidas.');
        }

        const user = new User(stored);
        if (!user.validatePassword(password)) {
            throw new CustomError(401, 'Credenciais inválidas.');
        }

        const token = createSessionToken(user);
        return sendSuccess(res, {
            data: { user: publicUser(user), token },
        });
    } catch (err) {
        try {
            rethrowAsApiError(err, 'Não foi possível processar a autenticação.');
        } catch (error) {
            return next(error);
        }
    }
});

/**
 * Returns the authenticated user's current session payload.
 */
router.get('/me', authMiddleware, async (req, res, next) => {
    try {
        const stored = await requireStoredUser(req.user.id);

        return sendSuccess(res, {
            data: { user: publicUser(stored) },
        });
    } catch (err) {
        try {
            rethrowAsApiError(err, 'Não foi possível validar a sessão.');
        } catch (error) {
            return next(error);
        }
    }
});

/**
 * Changes the authenticated user's password after validating the current password.
 */
router.patch('/password', authMiddleware, async (req, res, next) => {
    try {
        const stored = await requireStoredUser(req.user.id);
        const { currentPassword, newPassword } = parsePasswordChangePayload(req.body);
        const user = new User(stored);

        if (!user.validatePassword(currentPassword)) {
            throw new CustomError(401, 'A senha atual está incorreta.');
        }

        const updatedUser = await User.updatePassword(stored.id, newPassword);
        return sendSuccess(res, {
            data: { user: publicUser(updatedUser) },
            message: 'Senha atualizada.',
        });
    } catch (err) {
        try {
            rethrowAsApiError(err, 'Não foi possível atualizar a senha.');
        } catch (error) {
            return next(error);
        }
    }
});

/**
 * Lists safe user records for administrator dashboard tools.
 */
router.get('/users', authMiddleware, async (req, res, next) => {
    try {
        const actor = await requireStoredUser(req.user.id);
        requireAdminUser(actor);

        const users = await User.listForAdministration({ excludeId: actor.id });
        return sendSuccess(res, {
            data: { users: users.map(publicUser) },
        });
    } catch (err) {
        try {
            rethrowAsApiError(err, 'Não foi possível carregar os usuários.');
        } catch (error) {
            return next(error);
        }
    }
});

/**
 * Promotes a member account to administrator.
 */
router.patch('/users/:id/promote', authMiddleware, async (req, res, next) => {
    try {
        const actor = await requireStoredUser(req.user.id);
        requireAdminUser(actor);

        const targetUser = await User.findById(req.params.id);
        ensurePromotableUser(targetUser, actor.id);

        const updatedUser = await User.promoteToAdmin(targetUser.id);
        return sendSuccess(res, {
            data: { user: publicUser(updatedUser) },
            message: 'Usuário promovido a administrador.',
        });
    } catch (err) {
        try {
            rethrowAsApiError(err, 'Não foi possível promover o usuário.');
        } catch (error) {
            return next(error);
        }
    }
});
