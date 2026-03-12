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
