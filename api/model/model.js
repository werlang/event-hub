import { Mysql } from '../helpers/mysql.js';

export class Model {

    static table = '';
    static driver = Mysql;
    static view = [];

    static normalize(row) {
        return row;
    }

    static serialize(payload) {
        return payload;
    }

    static async find({ filter = {}, view = this.view, opt = {} } = {}) {
        const rows = await this.driver.find(this.table, { filter, view, opt });
        return rows.map(row => this.normalize(row));
    }

    static async get(clause, { view = this.view } = {}) {
        const filter = typeof clause === 'object' ? clause : { id: clause };
        const rows = await this.driver.find(this.table, {
            filter,
            view,
            opt: { limit: 1 },
        });

        return this.normalize(rows[0]) || null;
    }

    static async insert(payload) {
        const serialized = this.serialize(payload);
        await this.driver.insert(this.table, serialized);
        return serialized;
    }

    static async update(clause, payload) {
        const serialized = this.serialize(payload);
        await this.driver.update(this.table, serialized, clause);
    }

    static async delete(clause, opt = {}) {
        await this.driver.delete(this.table, clause, opt);
    }
}
