import express from 'express';
import { User } from '../model/user.js';
import { store } from '../helpers/store.js';
import { signToken } from '../helpers/token.js';
import { authMiddleware } from '../middleware/auth.js';

export const router = express.Router();

router.post('/register', async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }

    const existing = await store.findUserByEmail(email);
    if (existing) {
        return res.status(409).json({ error: 'Já existe uma conta com este e-mail.' });
    }

    const user = new User({ name, email, password });
    try {
        await store.addUser(user.toJSON());
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Já existe uma conta com este e-mail.' });
        }
        console.error('Erro ao registrar usuário', err);
        return res.status(500).json({ error: 'Não foi possível concluir o registro.' });
    }

    const token = signToken({ id: user.id, name: user.name, email: user.email });
    res.status(201).json({ user: { id: user.id, name: user.name, email: user.email }, token });
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({ error: 'Informe e-mail e senha.' });
    }

    let stored;
    try {
        stored = await store.findUserByEmail(email);
    } catch (err) {
        console.error('Erro ao buscar usuário', err);
        return res.status(500).json({ error: 'Não foi possível processar a autenticação.' });
    }
    if (!stored) {
        return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const user = new User(stored);
    if (!user.validatePassword(password)) {
        return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const token = signToken({ id: user.id, name: user.name, email: user.email });
    res.json({ user: { id: user.id, name: user.name, email: user.email }, token });
});

router.get('/me', authMiddleware, async (req, res) => {
    try {
        const stored = await store.findUserById(req.user.id);
        if (!stored) {
            return res.status(401).json({ error: 'Sessão expirada.' });
        }

        res.json({ user: { id: stored.id, name: stored.name, email: stored.email } });
    } catch (err) {
        console.error('Erro ao validar sessão', err);
        res.status(500).json({ error: 'Não foi possível validar a sessão.' });
    }
});
