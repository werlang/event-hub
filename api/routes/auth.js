import express from 'express';
import { User } from '../model/user.js';
import { Invite } from '../model/invite.js';
import { signToken } from '../helpers/token.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { CustomError } from '../helpers/error.js';
import { sendCreated, sendSuccess } from '../helpers/response.js';

export const router = express.Router();

const DEFAULT_INVITE_EXPIRATION_HOURS = 72;
const MIN_INVITE_EXPIRATION_HOURS = 1;
const MAX_INVITE_EXPIRATION_HOURS = 24 * 30;

function rethrowAsApiError(error, fallbackMessage) {
    if (error instanceof CustomError || Number.isInteger(error?.status)) {
        throw error;
    }

    throw new CustomError(500, fallbackMessage, {
        detail: error?.message || String(error),
    }, error);
}

function publicUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
    };
}

function createSessionToken(user) {
    return signToken({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
    });
}

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

router.get('/me', authMiddleware, async (req, res, next) => {
    try {
        const stored = await User.findById(req.user.id);
        if (!stored) {
            throw new CustomError(401, 'Sessão expirada.');
        }

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

router.post('/invites', authMiddleware, requireRole('admin'), async (req, res, next) => {
    try {
        const requestedRole = User.normalizeRole(req.body?.role || 'member');
        const rawHours = Number(req.body?.expiresInHours || DEFAULT_INVITE_EXPIRATION_HOURS);
        const expiresInHours = Number.isFinite(rawHours)
            ? Math.min(MAX_INVITE_EXPIRATION_HOURS, Math.max(MIN_INVITE_EXPIRATION_HOURS, rawHours))
            : DEFAULT_INVITE_EXPIRATION_HOURS;

        const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();
        const invite = await Invite.create({
            role: requestedRole,
            createdBy: req.user.id,
            expiresAt,
        });

        return sendCreated(res, {
            data: {
                invite: {
                    id: invite.id,
                    token: invite.token,
                    role: invite.role,
                    expiresAt: invite.expiresAt,
                    usedAt: invite.usedAt,
                    createdBy: invite.createdBy,
                },
            },
            message: 'Convite gerado com sucesso.',
        });
    } catch (err) {
        try {
            rethrowAsApiError(err, 'Não foi possível gerar o convite.');
        } catch (error) {
            return next(error);
        }
    }
});
