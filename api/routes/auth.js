import express from 'express';
import { sendWeeklyDigest } from '../background/weekly-digest-task.js';
import { EmailVerificationEmailManager } from '../helpers/email-verification-email-manager.js';
import { User } from '../model/user.js';
import { EmailVerificationToken } from '../model/email-verification-token.js';
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
        emailVerifiedAt: user.emailVerifiedAt ?? user.email_verified_at ?? null,
        emailPreferences: User.normalizeEmailPreferences(user?.emailPreferences || user),
    };
}

/**
 * Validates the public registration payload.
 * A filled `website` field means an automated bot hit the hidden honeypot:
 * the request is accepted silently without creating an account.
 */
function parseRegisterPayload(payload = {}) {
    const website = typeof payload.website === 'string'
        ? payload.website.trim()
        : '';

    if (website) {
        return { isSpam: true };
    }

    const name = typeof payload.name === 'string' ? payload.name.trim() : '';
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
    const password = typeof payload.password === 'string' ? payload.password : '';

    if (!name || !email || !password) {
        throw new HttpError(400, 'Nome, e-mail e senha são obrigatórios.');
    }

    return { name, email, password, isSpam: false };
}

/**
 * Validates the account verification payload carrying a one-time token.
 */
function parseVerificationPayload(payload = {}) {
    const token = typeof payload.token === 'string'
        ? payload.token.trim()
        : '';

    if (!token) {
        throw new HttpError(400, 'Informe o link de confirmação.');
    }

    return { token };
}

/**
 * Validates the verification resend payload carrying the account e-mail.
 */
function parseVerificationResendPayload(payload = {}) {
    const email = typeof payload.email === 'string'
        ? payload.email.trim().toLowerCase()
        : '';

    if (!email) {
        throw new HttpError(400, 'Informe o e-mail da conta.');
    }

    return { email };
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

    if (!User.isEmailVerified(storedUser)) {
        throw new HttpError(403, 'Confirme seu e-mail para acessar sua conta.');
    }

    return storedUser;
}

/**
 * Issues a fresh confirmation token and sends the verification e-mail.
 * Failures are logged without breaking registration so the link can be resent.
 */
async function sendVerificationEmail(user) {
    try {
        await EmailVerificationToken.invalidateActiveForUser(user.id);
        const confirmation = await EmailVerificationToken.createForUser(user.id);
        const mailer = new EmailVerificationEmailManager();
        await mailer.sendVerificationEmail(user, confirmation.token);
    } catch (error) {
        console.error('Failed to send e-mail verification message:', error);
    }
}

/**
 * Handles account creation as a pending account and sends the confirmation e-mail.
 */
router.post('/register', async (req, res, next) => {
    try {
        const { name, email, password, isSpam } = parseRegisterPayload(req.body);

        if (isSpam) {
            return sendCreated(res, {
                data: { verificationRequired: true },
                message: 'Cadastro recebido. Verifique seu e-mail para confirmar a conta.',
            });
        }

        const existing = await User.findByEmail(email);
        if (existing && User.isEmailVerified(existing)) {
            throw new HttpError(409, 'Já existe uma conta com este e-mail.');
        }

        if (existing) {
            const refreshedProfile = await User.updateProfile(existing.id, { name, email });
            const refreshedUser = await User.updatePassword(refreshedProfile.id, password);
            await sendVerificationEmail(refreshedUser);

            return sendCreated(res, {
                data: { user: publicUser(refreshedUser), verificationRequired: true },
                message: 'Cadastro recebido. Verifique seu e-mail para confirmar a conta.',
            });
        }

        const user = await User.create({
            name,
            email,
            password,
            emailVerifiedAt: null,
        });

        await sendVerificationEmail(user);

        return sendCreated(res, {
            data: { user: publicUser(user), verificationRequired: true },
            message: 'Cadastro recebido. Verifique seu e-mail para confirmar a conta.',
        });
    } catch (err) {
        return next(err instanceof HttpError ? err : new HttpError(500, 'Não foi possível criar a conta.', err));
    }
});

/**
 * Confirms a pending account through a one-time e-mail token.
 */
router.post('/verify-email', async (req, res, next) => {
    try {
        const { token } = parseVerificationPayload(req.body);
        const confirmation = await EmailVerificationToken.findUsableByToken(token);

        if (!confirmation) {
            throw new HttpError(400, 'Link de confirmação inválido ou expirado.');
        }

        const user = await User.findById(confirmation.userId);
        if (!user) {
            throw new HttpError(400, 'Link de confirmação inválido ou expirado.');
        }

        const verifiedUser = User.isEmailVerified(user)
            ? user
            : await User.markEmailVerified(user.id);
        await EmailVerificationToken.invalidateActiveForUser(user.id);

        return sendSuccess(res, {
            data: { user: publicUser(verifiedUser) },
            message: 'E-mail confirmado. Você já pode entrar.',
        });
    } catch (err) {
        return next(err instanceof HttpError ? err : new HttpError(500, 'Não foi possível confirmar a conta.', err));
    }
});

/**
 * Resends the confirmation link without disclosing whether the account is pending.
 */
router.post('/verify-email/resend', async (req, res, next) => {
    try {
        const { email } = parseVerificationResendPayload(req.body);
        const user = await User.findByEmail(email);

        if (user && !User.isEmailVerified(user)) {
            await sendVerificationEmail(user);
        }

        return sendSuccess(res, {
            status: 202,
            message: 'Se o e-mail estiver pendente de confirmação, enviaremos um novo link.',
        });
    } catch (err) {
        return next(err instanceof HttpError ? err : new HttpError(500, 'Não foi possível reenviar a confirmação.', err));
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

        if (!User.isEmailVerified(stored)) {
            throw new HttpError(403, 'Confirme seu e-mail para acessar sua conta.');
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
