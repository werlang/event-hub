import express from 'express';
import { User } from '../model/user.js';
import { store } from '../helpers/store.js';
import { signToken } from '../helpers/token.js';
import { authMiddleware } from '../middleware/auth.js';
import CustomError from '../helpers/error.js';
import { sendCreated, sendSuccess } from '../helpers/response.js';

export const router = express.Router();

function rethrowAsApiError(error, fallbackMessage) {
    if (error instanceof CustomError) {
        throw error;
    }

    throw new CustomError(500, fallbackMessage);
}

router.post('/register', async (req, res, next) => {
    try {
        const { name, email, password } = req.body || {};
        if (!name || !email || !password) {
            throw new CustomError(400, 'Nome, e-mail e senha são obrigatórios.');
        }

        const existing = await store.findUserByEmail(email);
        if (existing) {
            throw new CustomError(409, 'Já existe uma conta com este e-mail.');
        }

        const user = new User({ name, email, password });
        await store.addUser(user.toJSON());

        const token = signToken({ id: user.id, name: user.name, email: user.email });
        return sendCreated(res, {
            data: { user: { id: user.id, name: user.name, email: user.email }, token },
        });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return next(new CustomError(409, 'Já existe uma conta com este e-mail.'));
        }

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

        const stored = await store.findUserByEmail(email);
        if (!stored) {
            throw new CustomError(401, 'Credenciais inválidas.');
        }

        const user = new User(stored);
        if (!user.validatePassword(password)) {
            throw new CustomError(401, 'Credenciais inválidas.');
        }

        const token = signToken({ id: user.id, name: user.name, email: user.email });
        return sendSuccess(res, {
            data: { user: { id: user.id, name: user.name, email: user.email }, token },
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
        const stored = await store.findUserById(req.user.id);
        if (!stored) {
            throw new CustomError(401, 'Sessão expirada.');
        }

        return sendSuccess(res, {
            data: { user: { id: stored.id, name: stored.name, email: stored.email } },
        });
    } catch (err) {
        try {
            rethrowAsApiError(err, 'Não foi possível validar a sessão.');
        } catch (error) {
            return next(error);
        }
    }
});
