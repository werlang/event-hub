import { describe, expect, test } from '@jest/globals';
import { Model } from '../../model/model.js';

class ExampleModel extends Model {
    static table = 'examples';
    static view = ['id', 'name'];

    /**
     * Adds a marker so the test can verify normalization is applied.
     */
    static normalize(row) {
        return row ? { ...row, normalized: true } : null;
    }

    /**
     * Adds a marker so the test can verify serialization is applied.
     */
    static serialize(payload) {
        return { ...payload, serialized: true };
    }
}

describe('model/model', () => {
    test('base normalize and serialize return the payload unchanged', () => {
        expect(Model.normalize({ id: '1' })).toEqual({ id: '1' });
        expect(Model.serialize({ id: '1' })).toEqual({ id: '1' });
    });

    test('find delegates to the driver and normalizes every row', async () => {
        const calls = [];
        ExampleModel.driver = {
            async find(table, options) {
                calls.push({ table, options });
                return [{ id: '1' }, { id: '2' }];
            },
        };

        const rows = await ExampleModel.find({ filter: { active: true } });

        expect(calls[0]).toEqual({
            table: 'examples',
            options: {
                filter: { active: true },
                view: ['id', 'name'],
                opt: {},
            },
        });
        expect(rows).toEqual([
            { id: '1', normalized: true },
            { id: '2', normalized: true },
        ]);
    });

    test('get retrieves the first row and returns null when empty', async () => {
        let row = { id: '1' };
        ExampleModel.driver = {
            async findOne() {
                return row;
            },
        };

        await expect(ExampleModel.get('1')).resolves.toEqual({ id: '1', normalized: true });
        row = null;
        await expect(ExampleModel.get('2')).resolves.toBeNull();
    });

    test('get accepts object clauses and custom projections', async () => {
        let received;
        ExampleModel.driver = {
            async findOne(table, options) {
                received = { table, options };
                return { id: '1' };
            },
        };

        await ExampleModel.get({ slug: 'ada' }, { view: ['id'] });

        expect(received).toEqual({
            table: 'examples',
            options: {
                filter: { slug: 'ada' },
                view: ['id'],
            },
        });
    });

    test('insert serializes before delegating to the driver', async () => {
        const calls = [];
        ExampleModel.driver = {
            async insert(table, payload) {
                calls.push({ table, payload });
            },
        };

        const inserted = await ExampleModel.insert({ id: '1' });

        expect(inserted).toEqual({ id: '1', serialized: true });
        expect(calls).toEqual([{ table: 'examples', payload: { id: '1', serialized: true } }]);
    });

    test('update serializes the payload before delegating to the driver', async () => {
        const calls = [];
        ExampleModel.driver = {
            async update(table, payload, clause) {
                calls.push({ table, payload, clause });
            },
        };

        await ExampleModel.update('1', { name: 'Ada' });

        expect(calls).toEqual([{ table: 'examples', payload: { name: 'Ada', serialized: true }, clause: '1' }]);
    });

    test('delete delegates to the driver with the provided options', async () => {
        const calls = [];
        ExampleModel.driver = {
            async delete(table, clause, options) {
                calls.push({ table, clause, options });
            },
        };

        await ExampleModel.delete({ active: false }, { limit: 1 });

        expect(calls).toEqual([{ table: 'examples', clause: { active: false }, options: { limit: 1 } }]);
    });
});
