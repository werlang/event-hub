import express from 'express';
import { User } from '../model/user.js';
import { store } from '../helpers/store.js';
import { signToken } from '../helpers/token.js';
import { authMiddleware } from '../middleware/auth.js';
import CustomError from '../helpers/error.js';
import { sendSuccess } from '../helpers/response.js';

export const router = express.Router();

router.post('/register', async (req, res, next) => {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
        return next(new CustomError(400, 'Nome, e-mail e senha são obrigatórios.'));
    }

    try {
        const existing = await store.findUserByEmail(email);
        if (existing) {
            return next(new CustomError(409, 'Já existe uma conta com este e-mail.'));
        }

        const user = new User({ name, email, password });
        await store.addUser(user.toJSON());

        const token = signToken({ id: user.id, name: user.name, email: user.email });
        return sendSuccess(res, {
            status: 201,
            data: { user: { id: user.id, name: user.name, email: user.email }, token },
        });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return next(new CustomError(409, 'Já existe uma conta com este e-mail.'));
        }
        return next(new CustomError(500, 'Não foi possível concluir o registro.'));
    }
});

router.post('/login', async (req, res, next) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
        return next(new CustomError(400, 'Informe e-mail e senha.'));
    }

    try {
        const stored = await store.findUserByEmail(email);
        if (!stored) {
            return next(new CustomError(401, 'Credenciais inválidas.'));
        }

        const user = new User(stored);
        if (!user.validatePassword(password)) {
            return next(new CustomError(401, 'Credenciais inválidas.'));
        }

        const token = signToken({ id: user.id, name: user.name, email: user.email });
        return sendSuccess(res, {
            data: { user: { id: user.id, name: user.name, email: user.email }, token },
        });
    } catch (err) {
        return next(new CustomError(500, 'Não foi possível processar a autenticação.'));
    }
});

router.get('/me', authMiddleware, async (req, res, next) => {
    try {
        const stored = await store.findUserById(req.user.id);
        if (!stored) {
            return next(new CustomError(401, 'Sessão expirada.'));
        }

        return sendSuccess(res, {
            data: { user: { id: stored.id, name: stored.name, email: stored.email } },
        });
    } catch (err) {
        return next(new CustomError(500, 'Não foi possível validar a sessão.'));
    }
});
