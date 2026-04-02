import { describe, expect, test } from '@jest/globals';
import { CustomError } from '../../helpers/error.js';
import { Relation } from '../../model/relation.js';

/**
 * Creates an in-memory relation driver for deterministic relation tests.
 */
function createRelationDriver(initialRows = []) {
    const rows = initialRows.map(row => ({ ...row }));

    return {
        rows,
        async find(tableName, { filter }) {
            return rows.filter(row => Object.entries(filter).every(([key, value]) => row[key] === value));
        },
        async insert(tableName, row) {
            rows.push({ ...row });
            return row;
        },
        async delete(tableName, filter) {
            for (let index = rows.length - 1; index >= 0; index -= 1) {
                const matches = Object.entries(filter).every(([key, value]) => rows[index][key] === value);
                if (matches) {
                    rows.splice(index, 1);
                }
            }
        },
        async update(tableName, payload, filter) {
            for (const row of rows) {
                const matches = Object.entries(filter).every(([key, value]) => row[key] === value);
                if (matches) {
                    Object.assign(row, payload);
                }
            }
        },
    };
}

describe('model/relation', () => {
    test('check reports whether a linked row exists', async () => {
        const relation = new Relation(
            'event_tags',
            { event_id: 'event-1' },
            'tag_id',
            createRelationDriver([{ event_id: 'event-1', tag_id: 'tag-1' }]),
        );

        await expect(relation.check('tag-1')).resolves.toBe(true);
        await expect(relation.check('tag-2')).resolves.toBe(false);
    });

    test('insert prevents duplicates unless explicitly ignored', async () => {
        const driver = createRelationDriver([{ event_id: 'event-1', tag_id: 'tag-1' }]);
        const relation = new Relation('event_tags', { event_id: 'event-1' }, 'tag_id', driver);

        await expect(relation.insert('tag-1')).rejects.toThrow(CustomError);
        await expect(relation.insert('tag-1', { ignoreDuplicates: true })).resolves.toBeNull();
    });

    test('insertMany de-duplicates values and inserts the missing links only once', async () => {
        const driver = createRelationDriver([{ event_id: 'event-1', tag_id: 'tag-1' }]);
        const relation = new Relation('event_tags', { event_id: 'event-1' }, 'tag_id', driver);

        const inserted = await relation.insertMany(['tag-1', 'tag-2', 'tag-2', '  tag-3  '], {
            ignoreDuplicates: true,
        });

        expect(inserted).toHaveLength(2);
        expect(driver.rows).toEqual([
            { event_id: 'event-1', tag_id: 'tag-1' },
            { event_id: 'event-1', tag_id: 'tag-2' },
            { event_id: 'event-1', tag_id: 'tag-3' },
        ]);
    });

    test('replace swaps the full relation set', async () => {
        const driver = createRelationDriver([
            { event_id: 'event-1', tag_id: 'tag-1' },
            { event_id: 'event-1', tag_id: 'tag-2' },
        ]);
        const relation = new Relation('event_tags', { event_id: 'event-1' }, 'tag_id', driver);

        await relation.replace(['tag-3']);

        expect(driver.rows).toEqual([{ event_id: 'event-1', tag_id: 'tag-3' }]);
    });

    test('delete rejects missing relations and removes existing ones', async () => {
        const driver = createRelationDriver([{ event_id: 'event-1', tag_id: 'tag-1' }]);
        const relation = new Relation('event_tags', { event_id: 'event-1' }, 'tag_id', driver);

        await expect(relation.delete('tag-2')).rejects.toThrow(CustomError);
        await relation.delete('tag-1');

        expect(driver.rows).toEqual([]);
    });

    test('update ignores undefined fields and persists extra payload columns', async () => {
        const driver = createRelationDriver([{ event_id: 'event-1', tag_id: 'tag-1', weight: 1 }]);
        const relation = new Relation('event_tags', { event_id: 'event-1' }, 'tag_id', driver);

        await relation.update('tag-1', { weight: 5, note: undefined, pinned: true });

        expect(driver.rows).toEqual([
            { event_id: 'event-1', tag_id: 'tag-1', weight: 5, pinned: true },
        ]);
    });
});