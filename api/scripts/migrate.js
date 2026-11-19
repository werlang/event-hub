import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Mysql } from '../helpers/mysql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');
export const MIGRATION_LOCK_NAME = 'event_hub_schema_migrations';
export const MIGRATION_LOCK_TIMEOUT_SECONDS = 60;

/**
 * Removes SQL line comments before splitting a script into ordered,
 * non-empty statements.
 *
 * Removing comments first prevents semicolons inside `--` comments from
 * becoming executable statement fragments.
 *
 * @param {string} sqlContent Migration SQL source.
 * @returns {string[]} Ordered executable SQL statements.
 */
export function splitSqlStatements(sqlContent) {
    const uncommentedSql = sqlContent.replace(/--.*$/gm, '');

    return uncommentedSql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
}

/**
 * Runs versioned forward-only database migrations from `api/migrations/`.
 *
 * Acquires a MySQL advisory lock on a dedicated connection for the duration of
 * the run, ensures `schema_migrations` exists, and applies each pending
 * `<version>_<name>.sql` file in numeric order.
 *
 * @returns {Promise<void>}
 */
export async function migrate() {
    await Mysql.connect();
    const pool = Mysql.connection;

    // Pin advisory lock to a single connection session across the entire migration run.
    const lockConnection = typeof pool.getConnection === 'function'
        ? await pool.getConnection()
        : pool;
    let lockAcquired = false;

    let migrationError;
    try {
        const [lockRows] = await lockConnection.query(
            'SELECT GET_LOCK(?, ?) AS acquired',
            [MIGRATION_LOCK_NAME, MIGRATION_LOCK_TIMEOUT_SECONDS]
        );
        if (Number(lockRows?.[0]?.acquired) !== 1) {
            throw new Error(
                `Could not acquire migration lock "${MIGRATION_LOCK_NAME}" within ${MIGRATION_LOCK_TIMEOUT_SECONDS}s.`
            );
        }
        lockAcquired = true;

        await pool.query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `);

        const [rows] = await pool.query('SELECT version FROM schema_migrations');
        const appliedVersions = new Set(rows.map(row => Number(row.version)));

        let files = [];
        try {
            files = await fs.readdir(MIGRATIONS_DIR);
        } catch {
            files = [];
        }

        const migrationFiles = files
            .filter(file => file.endsWith('.sql'))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

        for (const file of migrationFiles) {
            const match = file.match(/^(\d+)_/);
            if (!match) continue;

            const version = parseInt(match[1], 10);
            if (appliedVersions.has(version)) {
                continue;
            }

            const filePath = path.join(MIGRATIONS_DIR, file);
            const sqlContent = await fs.readFile(filePath, 'utf-8');
            const statements = splitSqlStatements(sqlContent);

            console.log(`Applying migration ${file}...`);
            await Mysql.withTransaction(async ({ connection }) => {
                for (const statement of statements) {
                    await connection.query(statement);
                }
                await connection.query(
                    'INSERT INTO schema_migrations (version, name) VALUES (?, ?)',
                    [version, file]
                );
            });
            console.log(`Successfully applied migration ${file}.`);
        }
    } catch (err) {
        migrationError = err;
        throw err;
    } finally {
        try {
            if (lockAcquired) {
                await lockConnection.query('SELECT RELEASE_LOCK(?)', [MIGRATION_LOCK_NAME]);
            }
        } catch (unlockErr) {
            if (migrationError) {
                console.error('Failed to release advisory lock after migration error:', unlockErr);
            } else {
                throw unlockErr;
            }
        } finally {
            if (typeof lockConnection.release === 'function') {
                lockConnection.release();
            }
        }
    }
}

if (process.argv[1] === __filename) {
    migrate()
        .then(() => {
            console.log('Database migration completed successfully.');
            return Mysql.close();
        })
        .catch(async err => {
            console.error('Migration failed:', err);
            await Mysql.close();
            process.exit(1);
        });
}
