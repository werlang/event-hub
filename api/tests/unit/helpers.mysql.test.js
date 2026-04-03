import { afterEach, describe, expect, jest, test } from '@jest/globals';
import { CustomError } from '../../helpers/error.js';
import { Mysql } from '../../helpers/mysql.js';
import { restoreTracked, trackReplacement } from './support/doubles.js';

const restores = [];

afterEach(() => {
    restoreTracked(restores);
    Mysql.connected = false;
    Mysql.connection = null;
});

describe('helpers/mysql', () => {
    test('insert and update reject invalid payloads early', async () => {
        await expect(Mysql.insert('users')).rejects.toThrow('Invalid data for insert operation.');
        await expect(Mysql.update('users', { name: 'Ada' })).rejects.toThrow('No identifier provided for update.');
        await expect(Mysql.update('users', {}, 'user-1')).rejects.toThrow('No data to update.');
    });

    test('getWhereStatements supports nulls, arrays, and operator helpers', () => {
        const result = Mysql.getWhereStatements({
            email: null,
            role: ['admin', 'member'],
            age: { between: [18, 30] },
            name: { like: 'ada' },
            status: { not: 'archived' },
            created_at: { '>=': '2026-01-01 00:00:00' },
        });

        expect(result.statement).toBe('`email` IS NULL AND `role` IN (?,?) AND `age` BETWEEN ? AND ? AND `name` LIKE ? AND `status` != ? AND `created_at` >= ?');
        expect(result.values).toEqual([
            'admin',
            'member',
            18,
            30,
            '%ada%',
            'archived',
            '2026-01-01 00:00:00',
        ]);
    });

    test('getWhereStatements supports empty arrays, `in` clauses, and null negation', () => {
        const result = Mysql.getWhereStatements({
            role: [],
            status: { in: ['pending', 'rejected'] },
            organizer_id: { not: null },
        });

        expect(result.statement).toBe('1=0 AND `status` IN (?,?) AND `organizer_id` IS NOT NULL');
        expect(result.values).toEqual(['pending', 'rejected']);
    });

    test('formatRaw inlines raw SQL fragments and keeps placeholder values', () => {
        const formatted = Mysql.formatRaw(
            'INSERT INTO `events` (`created_at`, `title`) VALUES (?, ?)',
            [Mysql.raw('NOW()'), 'Semana Academica'],
        );

        expect(formatted.sql).toBe('INSERT INTO `events` (`created_at`, `title`) VALUES (NOW(), ?)');
        expect(formatted.data).toEqual(['Semana Academica']);
    });

    test('formatRaw tolerates missing iterable data and leaves placeholders intact', () => {
        const formatted = Mysql.formatRaw('SELECT ? AS value', null);

        expect(formatted).toEqual({
            sql: 'SELECT ? AS value',
            data: null,
        });
    });

    test('find builds a SELECT query and delegates execution through the pool', async () => {
        const execute = jest.fn().mockResolvedValue([[{ id: 'event-1' }]]);
        trackReplacement(restores, Mysql, 'connect', async () => {
            Mysql.connected = true;
            Mysql.connection = { execute, format: jest.fn() };
            return Mysql;
        });

        const rows = await Mysql.find('events', {
            filter: { status: 'published' },
            view: ['id', 'title'],
            opt: { order: { date: 1 }, limit: 5, skip: 10 },
        });

        expect(rows).toEqual([{ id: 'event-1' }]);
        expect(execute).toHaveBeenCalledWith(
            'SELECT `id`,`title` FROM `events` WHERE `status` = ? ORDER BY `date` ASC LIMIT 5 OFFSET 10',
            ['published'],
        );
    });

    test('find validates the filter type and supports wildcard projections', async () => {
        await expect(Mysql.find('events', { filter: 'invalid' })).rejects.toThrow('Invalid filter for find operation.');

        const execute = jest.fn().mockResolvedValue([[{ id: 'event-1' }]]);
        trackReplacement(restores, Mysql, 'connect', async () => {
            Mysql.connected = true;
            Mysql.connection = { execute, format: jest.fn() };
            return Mysql;
        });

        await Mysql.find('events');

        expect(execute).toHaveBeenCalledWith('SELECT * FROM `events`', []);
    });

    test('insert builds one INSERT statement per row', async () => {
        const execute = jest.fn().mockResolvedValue([[]]);
        trackReplacement(restores, Mysql, 'connect', async () => {
            Mysql.connected = true;
            Mysql.connection = { execute, format: jest.fn() };
            return Mysql;
        });

        await Mysql.insert('users', [{ id: 'user-1', name: 'Ada' }, { id: 'user-2', name: 'Grace' }]);

        expect(execute.mock.calls).toEqual([
            ['INSERT INTO `users` (`id`,`name`) VALUES (?,?)', ['user-1', 'Ada']],
            ['INSERT INTO `users` (`id`,`name`) VALUES (?,?)', ['user-2', 'Grace']],
        ]);
    });

    test('update builds arithmetic and object-clause updates', async () => {
        const execute = jest.fn().mockResolvedValue([[]]);
        trackReplacement(restores, Mysql, 'connect', async () => {
            Mysql.connected = true;
            Mysql.connection = { execute, format: jest.fn() };
            return Mysql;
        });

        await Mysql.update('events', {
            views: { inc: 2 },
            category: 'Tecnologia',
        }, {
            organizer_id: { not: 'user-1' },
        });

        expect(execute).toHaveBeenCalledWith(
            'UPDATE `events` SET `views` = views + ?, `category` = ? WHERE `organizer_id` != ?',
            [2, 'Tecnologia', 'user-1'],
        );
    });

    test('update supports decrement operations and rejects unsupported update operators', async () => {
        const execute = jest.fn().mockResolvedValue([[]]);
        trackReplacement(restores, Mysql, 'connect', async () => {
            Mysql.connected = true;
            Mysql.connection = { execute, format: jest.fn() };
            return Mysql;
        });

        await Mysql.update('events', { seats: { dec: 1 } }, 'event-1');

        expect(execute).toHaveBeenCalledWith(
            'UPDATE `events` SET `seats` = seats - ? WHERE `id` = ?',
            [1, 'event-1'],
        );

        await expect(Mysql.update('events', { seats: { multiply: 2 } }, 'event-1')).rejects.toThrow('Invalid update operation.');
    });

    test('delete builds a DELETE statement for object clauses and limits', async () => {
        const execute = jest.fn().mockResolvedValue([[]]);
        trackReplacement(restores, Mysql, 'connect', async () => {
            Mysql.connected = true;
            Mysql.connection = { execute, format: jest.fn() };
            return Mysql;
        });

        await Mysql.delete('events', { status: 'rejected' }, { limit: 3 });

        expect(execute).toHaveBeenCalledWith('DELETE FROM `events` WHERE `status` = ? LIMIT 3', ['rejected']);
    });

    test('delete validates the clause and supports deleting by id', async () => {
        await expect(Mysql.delete('events')).rejects.toThrow('Invalid clause for delete operation.');

        const execute = jest.fn().mockResolvedValue([[]]);
        trackReplacement(restores, Mysql, 'connect', async () => {
            Mysql.connected = true;
            Mysql.connection = { execute, format: jest.fn() };
            return Mysql;
        });

        await Mysql.delete('events', 'event-1');

        expect(execute).toHaveBeenCalledWith('DELETE FROM `events` WHERE id = ?', ['event-1']);
    });

    test('format requires an active mysql connection', () => {
        expect(() => Mysql.format('SELECT 1', [])).toThrow(CustomError);
    });

    test('format delegates to the active mysql connection when available', () => {
        Mysql.connection = {
            format(sql, data) {
                return `${sql}:${data.join(',')}`;
            },
        };

        expect(Mysql.format('SELECT ?', ['value'])).toBe('SELECT ?:value');
    });

    test('helper factories create useful filter payloads', () => {
        expect(Mysql.like('ada')).toEqual({ like: 'ada' });
        expect(Mysql.between(1, 2)).toEqual({ between: [1, 2] });
        expect(Mysql.ne('user-1')).toEqual({ not: 'user-1' });
        expect(Mysql.lt(10)).toEqual({ '<': 10 });
        expect(Mysql.gt(10)).toEqual({ '>': 10 });
        expect(Mysql.lte(10)).toEqual({ '<=': 10 });
        expect(Mysql.gte(10)).toEqual({ '>=': 10 });
        expect(Mysql.toDateTime('2026-04-02T12:34:56.000Z')).toBe('2026-04-02 12:34:56.000');
    });
});