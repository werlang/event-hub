import express from 'express';
import { sendWeeklyDigest } from '../background/weekly-digest-task.js';
import { User } from '../model/user.js';
import { signToken } from '../helpers/token.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdminUser } from '../middleware/authorization.js';
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
        emailPreferences: User.normalizeEmailPreferences(user?.emailPreferences || user),
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
 * Validates the authenticated e-mail preference update payload.
 */
function parseEmailPreferencesPayload(payload = {}) {
    const preferences = payload?.emailPreferences;

    if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
        throw new HttpError(400, 'Informe as preferências de e-mail.');
    }

    if (typeof preferences[User.EMAIL_PREFERENCE_KEYS.eventUpdates] !== 'boolean') {
        throw new HttpError(400, 'Informe todas as preferências de e-mail como verdadeiro ou falso.');
    }

    if (Object.hasOwn(preferences, User.EMAIL_PREFERENCE_KEYS.adminPendingRequests)
        && typeof preferences[User.EMAIL_PREFERENCE_KEYS.adminPendingRequests] !== 'boolean') {
        throw new HttpError(400, 'Informe todas as preferências de e-mail como verdadeiro ou falso.');
    }

    return User.normalizeEmailPreferences(preferences);
}

/**
 * Validates the optional time zone used by manual weekly digest runs.
 */
function parseManualDigestTimeZone(value) {
    if (value === undefined || value === null) {
        return null;
    }

    const timeZone = typeof value === 'string' ? value.trim() : '';

    if (!timeZone) {
        return null;
    }

    try {
        new Intl.DateTimeFormat('pt-BR', { timeZone }).format(new Date());
    } catch {
        throw new HttpError(400, 'Informe um fuso horário válido.');
    }

    return timeZone;
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
 * Updates the authenticated user's e-mail preference settings.
 */
router.put('/me/preferences',
    authMiddleware,
    async (req, res, next) => {
    try {
        const currentUser = await loadAuthenticatedUser(req.user.id);
        const emailPreferences = {
            ...User.normalizeEmailPreferences(currentUser?.emailPreferences || currentUser),
            ...parseEmailPreferencesPayload(req.body),
        };
        const updatedUser = await User.updateEmailPreferences(currentUser.id, emailPreferences);

        return sendSuccess(res, {
            data: { user: publicUser(updatedUser) },
            message: 'Preferências de e-mail atualizadas.',
        });
    } catch (err) {
        return next(err instanceof HttpError ? err : new HttpError(500, 'Não foi possível atualizar as preferências de e-mail.', err));
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
 * Sends the weekly digest immediately through the administrator settings tools.
 */
router.post('/weekly-digest/send',
    authMiddleware,
    requireAdminUser,
    async (req, res, next) => {
    try {
        await loadAuthenticatedUser(req.user.id);
        const manualTriggeredAt = new Date();
        const timeZone = parseManualDigestTimeZone(req.body?.timezone);

        const digest = await sendWeeklyDigest({
            referenceDate: manualTriggeredAt,
            manualTriggeredAt,
            timeZone,
        });

        return sendSuccess(res, {
            data: { digest },
            message: 'Email da agenda semanal enviado com sucesso.',
        });
    } catch (err) {
        return next(err instanceof HttpError ? err : new HttpError(500, 'Não foi possível enviar o email da agenda semanal.', err));
    }
});
