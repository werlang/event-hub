import jwt from 'jsonwebtoken';

const DEV_SECRET = 'dev-academic-events-local-secret-change-me';
const EXPIRES_IN = '12h';
const MIN_SECRET_LENGTH = 32;
const WEAK_SECRETS = new Set([
    'dev-academic-events',
    'dev-academic-events-local-secret-change-me',
    'changeme',
    'secret',
    'password',
]);

function isProduction() {
    return process.env.NODE_ENV === 'production';
}

function resolveSecret() {
    const configuredSecret = process.env.JWT_SECRET?.trim();

    if (!isProduction()) {
        return configuredSecret || DEV_SECRET;
    }

    if (!configuredSecret) {
        throw new Error('JWT_SECRET must be configured in production.');
    }

    if (configuredSecret.length < MIN_SECRET_LENGTH || WEAK_SECRETS.has(configuredSecret.toLowerCase())) {
        throw new Error('JWT_SECRET is too weak for production. Use at least 32 characters.');
    }

    return configuredSecret;
}

const SECRET = resolveSecret();

export function signToken(payload) {
    const subject = payload?.id || payload?.sub || payload?.email;
    return jwt.sign(payload, SECRET, {
        expiresIn: EXPIRES_IN,
        ...(subject ? { subject: String(subject) } : {}),
    });
}

export function verifyToken(token) {
    return jwt.verify(token, SECRET);
}
