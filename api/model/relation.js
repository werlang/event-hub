import { CustomError } from '../helpers/error.js';
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

export class Relation {
    /**
     * Creates a helper for managing many-to-many relation rows.
     */
    constructor(tableName, nativeObject, relatedField, driver = Mysql) {
        this.tableName = tableName;
        this.nativeObject = nativeObject;
        this.relatedField = relatedField;
        this.driver = driver;
    }

    /**
     * Checks whether a related value is already linked.
     */
    async check(fieldValue) {
        const relation = (await this.get()).find(r => String(r[this.relatedField]) === String(fieldValue));
        return relation ? true : false;
    }

    /**
     * Inserts a single relation row.
     */
    async insert(fieldValue, { ignoreDuplicates = false } = {}) {
        if (await this.check(fieldValue)) {
            if (ignoreDuplicates) return null;
            throw new CustomError('Relation already exists.');
        }

        return this.driver.insert(this.tableName, {
            ...this.nativeObject,
            [this.relatedField]: fieldValue,
        });
    }

    /**
     * Inserts a normalized set of relation values.
     */
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

    /**
     * Replaces the full relation set for the current native object.
     */
    async replace(fieldValues = [], { ignoreDuplicates = true } = {}) {
        await this.driver.delete(this.tableName, {
            ...this.nativeObject,
        });

        return this.insertMany(fieldValues, { ignoreDuplicates });
    }

    /**
     * Deletes a single related value from the relation table.
     */
    async delete(fieldValue) {
        if (!await this.check(fieldValue)) throw new CustomError('Relation does not exist.');
        return this.driver.delete(this.tableName, {
            ...this.nativeObject,
            [this.relatedField]: fieldValue,
        });
    }

    /**
     * Updates extra columns for an existing relation row.
     */
    async update(fieldValue, data) {
        if (!await this.check(fieldValue)) throw new CustomError('Relation does not exist.');
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

    /**
     * Returns every relation row for the current native object.
     */
    async get() {
        return await this.driver.find(this.tableName, { filter: {
            ...this.nativeObject,
        } });
    }

    /**
     * Returns every relation row whose related field matches any provided value.
     */
    async getMany(fieldValues = [], { view = [] } = {}) {
        const normalizedValues = [
            ...new Set(
                (fieldValues || [])
                    .map(value => String(value || '').trim())
                    .filter(Boolean),
            ),
        ];

        if (normalizedValues.length === 0) {
            return [];
        }

        return this.driver.find(this.tableName, {
            filter: {
                ...this.nativeObject,
                [this.relatedField]: { in: normalizedValues },
            },
            view,
        });
    }
}