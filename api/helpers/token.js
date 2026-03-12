import jwt from 'jsonwebtoken';

const EXPIRES_IN = '12h';

/**
 * Resolves and validates the JWT secret from the environment.
 */
function resolveSecret() {
    const configuredSecret = process.env.JWT_SECRET?.trim();

    if (!configuredSecret) {
        throw new Error('JWT_SECRET must be configured');
    }

    return configuredSecret;
}

const SECRET = resolveSecret();

/**
 * Signs an authentication token for the provided payload.
 */
export function signToken(payload) {
    const subject = payload?.id || payload?.sub || payload?.email;
    return jwt.sign(payload, SECRET, {
        expiresIn: EXPIRES_IN,
        ...(subject ? { subject: String(subject) } : {}),
    });
}

/**
 * Verifies and decodes a JWT using the configured secret.
 */
export function verifyToken(token) {
    return jwt.verify(token, SECRET);
}
