import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import { Mysql } from './mysql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.resolve(__dirname, '../data/schema.sql');
const ADMIN_EMAIL = 'admin@universidade.test';
const ADMIN_PASSWORD = 'changeme';
const BCRYPT_ROUNDS = 12;

function parseSqlStatements(sqlContent) {
    return sqlContent
        .split(';')
        .map(statement => statement.trim())
        .filter(Boolean);
}

async function ensureSchemaFromFile() {
    const schemaSql = await fs.readFile(schemaPath, 'utf-8');
    const statements = parseSqlStatements(schemaSql);

    for (const statement of statements) {
        await Mysql.query(statement, []);
    }
}

async function runMigrations() {
    const roleColumn = await Mysql.query(
        "SHOW COLUMNS FROM `users` LIKE 'role'",
        [],
    );

    if (roleColumn.length === 0) {
        await Mysql.query(
            "ALTER TABLE `users` ADD COLUMN `role` VARCHAR(32) NOT NULL DEFAULT 'member' AFTER `email`",
            [],
        );
    }

    await Mysql.query(
        `CREATE TABLE IF NOT EXISTS invites (
            id CHAR(36) PRIMARY KEY,
            token VARCHAR(96) NOT NULL UNIQUE,
            role VARCHAR(32) NOT NULL DEFAULT 'member',
            expires_at DATETIME NOT NULL,
            used_at DATETIME DEFAULT NULL,
            created_by CHAR(36) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
        [],
    );
}

async function seedAdminUser() {
    const rows = await Mysql.query('SELECT id FROM `users` WHERE `email` = ? LIMIT 1', [ADMIN_EMAIL]);

    if (rows.length > 0) {
        await Mysql.query('UPDATE `users` SET `role` = ? WHERE `email` = ?', ['admin', ADMIN_EMAIL]);
        return;
    }

    const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, BCRYPT_ROUNDS);
    await Mysql.query(
        'INSERT INTO `users` (`id`, `name`, `email`, `role`, `password_hash`, `created_at`) VALUES (?, ?, ?, ?, ?, NOW())',
        [crypto.randomUUID(), 'Administrador', ADMIN_EMAIL, 'admin', passwordHash],
    );
}

export async function initializeDatabase() {
    await Mysql.connect();
    await ensureSchemaFromFile();
    await runMigrations();
    await seedAdminUser();
}
