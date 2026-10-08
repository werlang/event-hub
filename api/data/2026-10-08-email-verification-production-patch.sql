-- Email verification for user registration (node-aec pattern).
-- New accounts are created with email_verified_at NULL (pending) and can only
-- log in after confirming the link. Existing accounts already passed the
-- previous creation boundary and must remain usable after deployment.
-- NOTE: plain ADD COLUMN (MySQL has no ADD COLUMN IF NOT EXISTS).
-- One-shot patch: safe to run once on databases created from the old schema.
ALTER TABLE users
    ADD COLUMN email_verified_at DATETIME DEFAULT NULL
    AFTER password_hash;

UPDATE users
SET email_verified_at = COALESCE(created_at, CURRENT_TIMESTAMP)
WHERE email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id CHAR(36) PRIMARY KEY,
    user_id CHAR(36) NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used_at DATETIME DEFAULT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX email_verification_tokens_user_idx (user_id),
    INDEX email_verification_tokens_lookup_idx (token_hash, used_at, expires_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
