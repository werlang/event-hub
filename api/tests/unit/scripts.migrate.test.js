import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { Mysql } from '../../helpers/mysql.js';
import {
    MIGRATION_LOCK_NAME,
    MIGRATION_LOCK_TIMEOUT_SECONDS,
    migrate,
    splitSqlStatements,
} from '../../scripts/migrate.js';

describe('scripts/migrate', () => {
    let mockPool;
    let mockLockConnection;
    let mockTxConnection;
    let logSpy;

    beforeEach(() => {
        mockLockConnection = {
            query: jest.fn().mockImplementation(async (sql) => {
                if (sql.includes('GET_LOCK')) {
                    return [[{ acquired: 1 }]];
                }
                return [[{ released: 1 }]];
            }),
            release: jest.fn(),
        };

        mockTxConnection = {
            query: jest.fn().mockResolvedValue([[]]),
        };

        mockPool = {
            query: jest.fn().mockImplementation(async (sql) => {
                if (sql.includes('SELECT version FROM schema_migrations')) {
                    return [[{ version: 1 }]];
                }
                return [[]];
            }),
            getConnection: jest.fn().mockResolvedValue(mockLockConnection),
        };

        jest.spyOn(Mysql, 'connect').mockResolvedValue(Mysql);
        Mysql.connection = mockPool;
        jest.spyOn(Mysql, 'withTransaction').mockImplementation(async (fn) => {
            await fn({ connection: mockTxConnection });
        });
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        Mysql.connection = null;
    });

    test('splits SQL statements correctly and strips line comments', () => {
        const sql = `
            -- Header comment
            CREATE TABLE foo (id INT);
            -- Mid comment; with semicolon
            INSERT INTO foo VALUES (1);
        `;

        expect(splitSqlStatements(sql)).toEqual([
            'CREATE TABLE foo (id INT)',
            'INSERT INTO foo VALUES (1)',
        ]);
    });

    test('acquires MySQL advisory lock on a dedicated connection, creates schema_migrations, applies pending migrations, and releases lock', async () => {
        await migrate();

        expect(mockPool.getConnection).toHaveBeenCalledTimes(1);
        expect(mockLockConnection.query).toHaveBeenCalledWith(
            'SELECT GET_LOCK(?, ?) AS acquired',
            [MIGRATION_LOCK_NAME, MIGRATION_LOCK_TIMEOUT_SECONDS]
        );
        expect(mockPool.query).toHaveBeenCalledWith(
            expect.stringContaining('CREATE TABLE IF NOT EXISTS schema_migrations')
        );
        expect(mockTxConnection.query).toHaveBeenCalledWith(
            'INSERT INTO schema_migrations (version, name) VALUES (?, ?)',
            [2, '002_password_reset.sql']
        );
        expect(mockTxConnection.query).toHaveBeenCalledWith(
            'INSERT INTO schema_migrations (version, name) VALUES (?, ?)',
            [3, '003_email_verification.sql']
        );
        expect(mockTxConnection.query).not.toHaveBeenCalledWith(
            'INSERT INTO schema_migrations (version, name) VALUES (?, ?)',
            [1, '001_initial_schema.sql']
        );
        expect(mockLockConnection.query).toHaveBeenCalledWith(
            'SELECT RELEASE_LOCK(?)',
            [MIGRATION_LOCK_NAME]
        );
        expect(mockLockConnection.release).toHaveBeenCalledTimes(1);
        expect(logSpy).toHaveBeenCalledWith('Applying migration 002_password_reset.sql...');
    });

    test('applies all checked-in migrations in numeric order when schema_migrations is empty', async () => {
        mockPool.query.mockImplementation(async (sql) => {
            if (sql.includes('SELECT version FROM schema_migrations')) {
                return [[]];
            }
            return [[]];
        });

        await migrate();

        const recordedMigrations = mockTxConnection.query.mock.calls
            .filter(([sql]) => sql.includes('INSERT INTO schema_migrations'))
            .map(([, params]) => params);

        expect(recordedMigrations).toEqual([
            [1, '001_initial_schema.sql'],
            [2, '002_password_reset.sql'],
            [3, '003_email_verification.sql'],
        ]);

        const executedSql = mockTxConnection.query.mock.calls
            .map(([sql]) => sql)
            .join('\n');

        expect(executedSql).toContain('CREATE TABLE IF NOT EXISTS users');
        expect(executedSql).toContain('CREATE TABLE IF NOT EXISTS events');
        expect(executedSql).toContain('CREATE TABLE IF NOT EXISTS password_reset_tokens');
        expect(executedSql).toContain('CREATE TABLE IF NOT EXISTS email_verification_tokens');
        expect(executedSql).toContain("COLUMN_NAME = 'email_verified_at'");
        expect(executedSql).toContain('ALTER TABLE users ADD COLUMN email_verified_at DATETIME DEFAULT NULL AFTER password_hash');
    });

    test('skips all migrations when every version is already applied', async () => {
        mockPool.query.mockImplementation(async (sql) => {
            if (sql.includes('SELECT version FROM schema_migrations')) {
                return [[{ version: 1 }, { version: 2 }, { version: 3 }]];
            }
            return [[]];
        });

        await migrate();

        expect(Mysql.withTransaction).not.toHaveBeenCalled();
        expect(mockLockConnection.query).toHaveBeenCalledWith(
            'SELECT RELEASE_LOCK(?)',
            [MIGRATION_LOCK_NAME]
        );
        expect(mockLockConnection.release).toHaveBeenCalledTimes(1);
    });

    test('throws and does not release lock when GET_LOCK does not return 1', async () => {
        mockLockConnection.query.mockResolvedValueOnce([[{ acquired: 0 }]]);

        await expect(migrate()).rejects.toThrow(
            `Could not acquire migration lock "${MIGRATION_LOCK_NAME}" within ${MIGRATION_LOCK_TIMEOUT_SECONDS}s.`
        );

        expect(mockLockConnection.query).not.toHaveBeenCalledWith(
            'SELECT RELEASE_LOCK(?)',
            [MIGRATION_LOCK_NAME]
        );
        expect(mockLockConnection.release).toHaveBeenCalledTimes(1);
    });

    test('always releases advisory lock and connection even when a migration transaction throws', async () => {
        mockPool.query.mockImplementation(async (sql) => {
            if (sql.includes('SELECT version FROM schema_migrations')) {
                return [[]];
            }
            return [[]];
        });
        Mysql.withTransaction.mockRejectedValueOnce(new Error('Syntax error in migration'));

        await expect(migrate()).rejects.toThrow('Syntax error in migration');

        expect(mockLockConnection.query).toHaveBeenCalledWith(
            'SELECT RELEASE_LOCK(?)',
            [MIGRATION_LOCK_NAME]
        );
        expect(mockLockConnection.release).toHaveBeenCalledTimes(1);
    });

    test('preserves the original migration error when RELEASE_LOCK also fails in finally', async () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockPool.query.mockImplementation(async (sql) => {
            if (sql.includes('SELECT version FROM schema_migrations')) {
                return [[]];
            }
            return [[]];
        });
        Mysql.withTransaction.mockRejectedValueOnce(new Error('Syntax error in migration'));
        mockLockConnection.query.mockImplementation(async (sql) => {
            if (sql.includes('GET_LOCK')) {
                return [[{ acquired: 1 }]];
            }
            throw new Error('Connection lost during unlock');
        });

        await expect(migrate()).rejects.toThrow('Syntax error in migration');

        expect(errorSpy).toHaveBeenCalledWith(
            'Failed to release advisory lock after migration error:',
            expect.any(Error)
        );
        expect(mockLockConnection.release).toHaveBeenCalledTimes(1);
    });

    test('throws unlock error when RELEASE_LOCK fails after successful migrations', async () => {
        mockPool.query.mockImplementation(async (sql) => {
            if (sql.includes('SELECT version FROM schema_migrations')) {
                return [[{ version: 1 }, { version: 2 }, { version: 3 }]];
            }
            return [[]];
        });
        mockLockConnection.query.mockImplementation(async (sql) => {
            if (sql.includes('GET_LOCK')) {
                return [[{ acquired: 1 }]];
            }
            throw new Error('Unlock connection reset');
        });

        await expect(migrate()).rejects.toThrow('Unlock connection reset');
        expect(mockLockConnection.release).toHaveBeenCalledTimes(1);
    });
});
