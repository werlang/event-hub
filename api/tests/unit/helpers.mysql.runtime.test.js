import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

const createPoolMock = jest.fn();
const mysqldumpMock = jest.fn();

async function loadMysqlModule() {
    jest.unstable_mockModule('mysql2/promise', () => ({
        default: { createPool: createPoolMock },
    }));
    jest.unstable_mockModule('mysqldump', () => ({
        default: mysqldumpMock,
    }));

    return import(`../../helpers/mysql.js?case=${Date.now()}-${Math.random()}`);
}

beforeEach(() => {
    jest.resetModules();
    createPoolMock.mockReset();
    mysqldumpMock.mockReset();
    process.env.NODE_ENV = 'test';
    process.env.MYSQL_DATABASE = 'agenda_ch';
    process.env.MYSQL_ROOT_PASSWORD = 'root';
    process.env.MYSQL_HOST = 'mysql';
    process.env.MYSQL_USER = 'root';
    process.env.MYSQL_INTERNAL_PORT = '3306';
    process.env.TEST_DATABASE_ID = 'suite';
});

afterEach(() => {
    jest.resetModules();
});

describe('helpers/mysql runtime lifecycle', () => {
    test('connect creates a pool once and suffixes the database in test mode', async () => {
        const pool = { end: jest.fn(), execute: jest.fn(), format: jest.fn() };
        createPoolMock.mockReturnValue(pool);

        const { Mysql } = await loadMysqlModule();

        const first = await Mysql.connect({ host: 'override-host' });
        const second = await Mysql.connect();

        expect(first).toBe(Mysql);
        expect(second).toBe(Mysql);
        expect(createPoolMock).toHaveBeenCalledTimes(1);
        expect(createPoolMock.mock.calls[0][0]).toMatchObject({
            host: 'override-host',
            user: 'root',
            password: 'root',
            database: 'agenda_ch_test_suite',
            port: 3306,
            multipleStatements: false,
        });
    });

    test('close is safe before connecting and ends the pool afterwards', async () => {
        const pool = { end: jest.fn(), execute: jest.fn(), format: jest.fn() };
        createPoolMock.mockReturnValue(pool);

        const { Mysql } = await loadMysqlModule();

        await expect(Mysql.close()).resolves.toBe(Mysql);
        await Mysql.connect();
        await Mysql.close();

        expect(pool.end).toHaveBeenCalledTimes(1);
        expect(Mysql.connected).toBe(false);
        expect(Mysql.connection).toBeNull();
    });

    test('find executes trimmed SQL and wraps driver failures as CustomError', async () => {
        const pool = {
            end: jest.fn(),
            format: jest.fn(),
            execute: jest.fn()
                .mockResolvedValueOnce([[{ id: 'event-1' }]])
                .mockRejectedValueOnce(new Error('boom')),
        };
        createPoolMock.mockReturnValue(pool);

        const { Mysql } = await loadMysqlModule();

        await expect(Mysql.find('events', { filter: { id: 'event-1' }, view: ['id'] })).resolves.toEqual([{ id: 'event-1' }]);
        await expect(Mysql.find('events', { filter: { id: 'value' }, view: ['id'] })).rejects.toMatchObject({
            data: expect.objectContaining({
                sql: expect.stringContaining('SELECT `id` FROM `events`'),
                data: ['value'],
            }),
        });
    });

    test('dump delegates to mysqldump with the configured connection data', async () => {
        mysqldumpMock.mockResolvedValue({ ok: true });

        const { Mysql } = await loadMysqlModule();

        await Mysql.dump('/tmp/dump.sql', { dump: { schema: true } });

        expect(mysqldumpMock).toHaveBeenCalledWith({
            connection: Mysql.config,
            dumpToFile: '/tmp/dump.sql',
            dump: { schema: true },
        });
    });
});
