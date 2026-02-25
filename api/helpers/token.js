import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev-academic-events';
const EXPIRES_IN = '12h';

export function signToken(payload) {
    return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token) {
    return jwt.verify(token, SECRET);
}
