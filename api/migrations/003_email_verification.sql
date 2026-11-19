-- Add email_verified_at only on databases created before email verification
-- existed, and backfill existing accounts only when the column is added so
-- pending unverified registrations are never altered on already-migrated DBs.
SET @has_email_verified_at = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'email_verified_at'
);

SET @add_email_verified_at_sql = IF(
    @has_email_verified_at = 0,
    'ALTER TABLE users ADD COLUMN email_verified_at DATETIME DEFAULT NULL AFTER password_hash',
    'SELECT 1'
);
PREPARE add_email_verified_at_stmt FROM @add_email_verified_at_sql;
EXECUTE add_email_verified_at_stmt;
DEALLOCATE PREPARE add_email_verified_at_stmt;

SET @backfill_email_verified_at_sql = IF(
    @has_email_verified_at = 0,
    'UPDATE users SET email_verified_at = COALESCE(created_at, CURRENT_TIMESTAMP) WHERE email_verified_at IS NULL',
    'SELECT 1'
);
PREPARE backfill_email_verified_at_stmt FROM @backfill_email_verified_at_sql;
EXECUTE backfill_email_verified_at_stmt;
DEALLOCATE PREPARE backfill_email_verified_at_stmt;

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
