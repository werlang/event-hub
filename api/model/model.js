import { Mysql } from '../helpers/mysql.js';

export class Model {

    static table = '';
    static driver = Mysql;
    static view = [];

    /**
     * Normalizes a raw database row into the model's public shape.
     */
    static normalize(row) {
        return row;
    }

    /**
     * Serializes a model payload into database column names.
     */
    static serialize(payload) {
        return payload;
    }

    /**
     * Finds multiple records for the current model.
     */
    static async find({ filter = {}, view = this.view, opt = {} } = {}) {
        const rows = await this.driver.find(this.table, { filter, view, opt });
        return rows.map(row => this.normalize(row));
    }

    /**
     * Retrieves a single record by id or arbitrary filter clause.
     */
    static async get(clause, { view = this.view } = {}) {
        const filter = typeof clause === 'object' ? clause : { id: clause };
        const row = await this.driver.findOne(this.table, {
            filter,
            view,
        });

        return row ? this.normalize(row) : null;
    }

    /**
     * Inserts a new record for the current model.
     */
    static async insert(payload) {
        const serialized = this.serialize(payload);
        await this.driver.insert(this.table, serialized);
        return serialized;
    }

    /**
     * Updates one or more records for the current model.
     */
    static async update(clause, payload) {
        const serialized = this.serialize(payload);
        await this.driver.update(this.table, serialized, clause);
    }

    /**
     * Deletes records matching the provided clause.
     */
    static async delete(clause, opt = {}) {
        await this.driver.delete(this.table, clause, opt);
    }
}
