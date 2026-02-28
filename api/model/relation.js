import CustomError from '../helpers/error.js';
import { Mysql } from '../helpers/mysql.js';

// Relation class to handle many-to-many relationships
//   tableName: name of the table to store the relation: e.g. contest_problems
//   nativeObject: object containing the field values of the current object: e.g. { contest: 1 }
//   relatedField: field name of the related object: e.g. 'problem'
// Methods:
// check(fieldValue): check if the relation exists
// insert(fieldValue): insert a new relation
// delete(fieldValue): delete an existing relation
// update(fieldValue, data): update an existing relation
// get(): get all related field values

export default class Relation {
    constructor(tableName, nativeObject, relatedField, driver = Mysql) {
        this.tableName = tableName;
        this.nativeObject = nativeObject;
        this.relatedField = relatedField;
        this.driver = driver;
    }

    async check(fieldValue) {
        const relation = (await this.get()).find(r => String(r[this.relatedField]) === String(fieldValue));
        return relation ? true : false;
    }

    async insert(fieldValue, { ignoreDuplicates = false } = {}) {
        if (await this.check(fieldValue)) {
            if (ignoreDuplicates) return null;
            throw new CustomError(400, 'Relation already exists.');
        }

        return this.driver.insert(this.tableName, {
            ...this.nativeObject,
            [this.relatedField]: fieldValue,
        });
    }

    async insertMany(fieldValues = [], { ignoreDuplicates = false } = {}) {
        const normalizedValues = [
            ...new Set(
                (fieldValues || [])
                    .map(value => String(value || '').trim())
                    .filter(Boolean),
            ),
        ];

        const inserted = [];
        for (const value of normalizedValues) {
            const relation = await this.insert(value, { ignoreDuplicates });
            if (relation) {
                inserted.push(relation);
            }
        }

        return inserted;
    }

    async replace(fieldValues = [], { ignoreDuplicates = true } = {}) {
        await this.driver.delete(this.tableName, {
            ...this.nativeObject,
        });

        return this.insertMany(fieldValues, { ignoreDuplicates });
    }

    async delete(fieldValue) {
        if (!await this.check(fieldValue)) throw new CustomError(404, 'Relation does not exist.');
        return this.driver.delete(this.tableName, {
            ...this.nativeObject,
            [this.relatedField]: fieldValue,
        });
    }

    async update(fieldValue, data) {
        if (!await this.check(fieldValue)) throw new CustomError(404, 'Relation does not exist.');
        const toChange = {};
        for (const key of Object.keys(data)) {
            if (data[key] !== undefined) {
                toChange[key] = data[key];
            }
        }
        return this.driver.update(this.tableName, toChange, {
            ...this.nativeObject,
            [this.relatedField]: fieldValue,
        });
    }

    async get() {
        return await this.driver.find(this.tableName, { filter: {
            ...this.nativeObject,
        } });
    }
}