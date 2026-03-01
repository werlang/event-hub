import { verifyToken } from '../helpers/token.js';
import { CustomError } from '../helpers/error.js';

export function authMiddleware(req, res, next) {
    const header = req.headers.authorization;
    if (!header || typeof header !== 'string') {
        return next(new CustomError(401, 'Autenticação necessária.'));
    }

    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
        return next(new CustomError(401, 'Autenticação necessária.'));
    }

    try {
        const decoded = verifyToken(token);
        req.user = decoded;
        return next();
    } catch (err) {
        return next(new CustomError(401, 'Sessão inválida ou expirada.'));
    }
}
