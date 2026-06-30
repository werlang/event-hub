import mysql from 'mysql2/promise';
import { CustomError } from './error.js';
import mysqldump from 'mysqldump';

export class Mysql {
        
    static connected = false;
    static connection = null;
    static #rawSqlSentinel = Symbol('raw-sql-fragment');
    static config = {
        host: process.env.MYSQL_HOST || 'mysql',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_ROOT_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        port: Number(process.env.MYSQL_INTERNAL_PORT || 3306),
        multipleStatements: false,
    }

    /**
     * Opens the shared MySQL connection pool when needed.
     */
    static async connect(config = {}) {
        if (Mysql.connected) return this;

        if (process.env.NODE_ENV == 'test') {
            Mysql.originalDatabase = process.env.MYSQL_DATABASE;
            Mysql.config.database = Mysql.originalDatabase + '_test_' + process.env.TEST_DATABASE_ID;
        }

        Mysql.connection = mysql.createPool({ ...Mysql.config, ...config });
        Mysql.connected = true;
        return this;
    }

    /**
     * Closes the shared MySQL connection pool.
     */
    static async close() {
        if (!Mysql.connected) return this;
        await Mysql.connection.end();
        Mysql.connection = null;
        Mysql.connected = false;
        return this;
    }

    /**
     * Quotes a SQL identifier, including dotted table/column references.
     */
    static #quoteIdentifier(identifier) {
        return String(identifier)
            .split('.')
            .map(part => part === '*' ? '*' : `\`${part.replace(/`/g, '``')}\``)
            .join('.');
    }

    /**
     * Drops undefined write fields and rejects empty payloads.
     */
    static #sanitizeWriteData(data, operation) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new CustomError(`Invalid data for ${operation} operation.`);
        }

        const sanitized = Object.fromEntries(
            Object.entries(data).filter(([, value]) => value !== undefined)
        );

        if (!Object.keys(sanitized).length) {
            throw new CustomError(`No data to ${operation}.`);
        }

        return sanitized;
    }

    /**
     * Executes a formatted SQL statement through mysql2.
     */
    static async #query(sql, data = [], { connection } = {}) {
        // console.log(sql, data);
        if (!connection) {
            await Mysql.connect();
        }

        const executor = connection || Mysql.connection;
        const raw = Mysql.formatRaw(sql, data);
        // console.log(raw);
        // console.log(Mysql.format(sql, data));
        try {
            const result = await executor.execute(raw.sql.trim(), raw.data);
            if (result) return result[0];
            return result;
        }
        catch (error) {
            throw new CustomError(error.message, {
                sql: raw.sql,
                data: raw.data,
                error,
            });
        }
    }

    /**
     * Inserts one or many rows into the provided table.
     */
    static async insert(table, data, context = {}) {
        if (!data) {
            throw new CustomError('Invalid data for insert operation.');
        }
        if (!Array.isArray(data)) data = [ data ];

        return Promise.all(data.map(row => {
            const sanitized = Mysql.#sanitizeWriteData(row, 'insert');
            const values = Object.values(sanitized);
            const fields = Object.keys(sanitized).map(k => Mysql.#quoteIdentifier(k));
            let sql = `INSERT INTO ${Mysql.#quoteIdentifier(table)} (${fields.join(',')}) VALUES (${values.map(() => '?').join(',')})`;
            return Mysql.#query(sql, values, context);
        }));
    }

    /**
     * Inserts a row or updates selected fields on duplicate-key conflicts.
     */
    static async upsert(table, data, { conflictFields = [], updateFields = [] } = {}, context = {}) {
        const sanitized = Mysql.#sanitizeWriteData(data, 'upsert');
        const fields = Object.keys(sanitized);
        const updatableFields = (updateFields.length ? updateFields : fields)
            .filter(field => !conflictFields.includes(field));

        if (!updatableFields.length) {
            throw new CustomError('No update fields provided for upsert operation.');
        }

        const fieldSql = fields.map(field => Mysql.#quoteIdentifier(field)).join(',');
        const valueSql = fields.map(() => '?').join(',');
        const updateSql = updatableFields
            .map(field => `${Mysql.#quoteIdentifier(field)} = VALUES(${Mysql.#quoteIdentifier(field)})`)
            .join(', ');
        const sql = `INSERT INTO ${Mysql.#quoteIdentifier(table)} (${fieldSql}) VALUES (${valueSql}) ON DUPLICATE KEY UPDATE ${updateSql}`;

        return Mysql.#query(sql, fields.map(field => sanitized[field]), context);
    }

    /**
     * Updates rows in the provided table using an id or filter clause.
     */
    static async update(table, data, id, context = {}) {
        if (!id) {
            throw new CustomError('No identifier provided for update.');
        }
        data = Mysql.#sanitizeWriteData(data, 'update');

        const values = Object.values(data);
        const fieldsSql = Object.entries(data).map(([k,v],i) => {
            if (v instanceof Date) {
                return `${Mysql.#quoteIdentifier(k)} = ?`;
            }

            if (v !== null && typeof v === 'object') {
                if (Object.hasOwn(v, 'inc')){
                    values[i] = v.inc;
                    return `${Mysql.#quoteIdentifier(k)} = ${Mysql.#quoteIdentifier(k)} + ?`;
                }
                else if (Object.hasOwn(v, 'dec')){
                    values[i] = v.dec;
                    return `${Mysql.#quoteIdentifier(k)} = ${Mysql.#quoteIdentifier(k)} - ?`;
                }
                else if (typeof v.toSqlString === 'function') {
                    values[i] = Mysql.#rawSqlSentinel;
                    return `${Mysql.#quoteIdentifier(k)} = ${v.toSqlString()}`;
                }
                else {
                    throw new CustomError('Invalid update operation.');
                }
            }

            return `${Mysql.#quoteIdentifier(k)} = ?`;
        }).join(', ');

        let whereSql = `${Mysql.#quoteIdentifier('id')} = ?`;
        if (typeof id === 'object') {
            const { statement, values: v } = this.getWhereStatements(id);
            whereSql = statement;
            values.push(...v);
        }
        else {
            values.push(id);
        }

        const sql = `UPDATE ${Mysql.#quoteIdentifier(table)} SET ${fieldsSql} WHERE ${whereSql}`;
        // console.log(Mysql.format(sql, data));
        // replicateDB.saveUpdate(table, sql, data, this);
        return Mysql.#query(sql, values.filter(value => value !== Mysql.#rawSqlSentinel), context);
    }

    /**
     * Deletes rows in the provided table using an id or filter clause.
     */
    static async delete(table, clause, opt={}, context = {}) {
        if (!clause) {
            throw new CustomError('Invalid clause for delete operation.');
        }

        const limit = opt.limit ? ` LIMIT ${ parseInt(opt.limit, 10) }` : '';

        let sql = '';
        const data = [];

        // check if clause is an object
        if (typeof clause === 'object'){
            const { statement, values } = Mysql.getWhereStatements(clause);
            sql = `DELETE FROM ${Mysql.#quoteIdentifier(table)} WHERE ${statement}${limit}`;
            data.push(...values);
        }
        else {
            sql = `DELETE FROM ${Mysql.#quoteIdentifier(table)} WHERE ${Mysql.#quoteIdentifier('id')} = ?`;
            data.push(clause);
        }
        
        return Mysql.#query(sql, data, context);
    }

    /**
     * Builds a SQL WHERE clause and placeholder values from a filter object.
     */
    static getWhereStatements(filter) {
        let values = [];

        const statement = Object.entries(filter).map(([k,v],i) => {
            // email: null
            if (v === null) return `${Mysql.#quoteIdentifier(k)} IS NULL`;

            if (Array.isArray(v)){
                // age: [18, 19, 20]
                if (v.length === 0) return '1=0';
                
                // add all values to the values array
                values.push(...v);
                return `${Mysql.#quoteIdentifier(k)} IN (${v.map(() => '?').join(',')})`;
            }
            else if (typeof v === 'object'){
                // age: { in: [18, 19, 20] }
                if (Object.hasOwn(v, 'in')){
                    if (!Array.isArray(v.in) || v.in.length === 0) return '1=0';
                    
                    // add all values to the values array
                    values.push(...v.in);
                    return `${Mysql.#quoteIdentifier(k)} IN (${v.in.map(() => '?').join(',')})`;
                }

                // age: { between: [18, 20] }
                if (Object.hasOwn(v, 'between')){
                    // add 2 values to the values array
                    values.push(v.between[0], v.between[1]);
                    return `${Mysql.#quoteIdentifier(k)} BETWEEN ? AND ?`;
                }

                // name: { like: '%John%' }
                if (Object.hasOwn(v, 'like')){
                    // replace the value with the like value
                    values.push(`%${v.like}%`);
                    return `${Mysql.#quoteIdentifier(k)} LIKE ?`;
                }

                // name: { not: 'John' }
                if (Object.hasOwn(v, 'not')){
                    // name: { not: null }
                    if (v.not === null) return `${Mysql.#quoteIdentifier(k)} IS NOT NULL`;
                    values.push(v.not);
                    return `${Mysql.#quoteIdentifier(k)} != ?`;
                }

                // age: { '>=': 18 }
                const e = Object.keys(v)[0];
                if (!['<', '<=', '>', '>='].includes(e)) {
                    throw new CustomError('Invalid filter operation.');
                }
                values.push(Object.values(v)[0]);
                return `${Mysql.#quoteIdentifier(k)} ${e} ?`;
            }

            // name: 'John'
            values.push(v);
            return `${Mysql.#quoteIdentifier(k)} = ?`;
        }).join(' AND ');

        return { statement, values };
    }

    /**
     * Finds rows in the provided table using filter, projection, and paging options.
     */
    static async find(table, { filter={}, view=[], opt={}} = {}, context = {}) {
        view = Array.isArray(view) ? view : [ view ];
        view = view.length > 0 ? view.map(v => Mysql.#quoteIdentifier(v)).join(',') : '*';

        // filter not an object
        if (typeof filter !== 'object' || Array.isArray(filter)) {
            throw new CustomError('Invalid filter for find operation.');
        }

        const filterNames = Object.keys(filter);
        let values = Object.values(filter);
        // WHERE name = ? AND age >= ?
        const {
            statement: whereStatements,
            values: whereValues,
        } = Mysql.getWhereStatements(filter);
        values = whereValues;

        const where = filterNames.length > 0 ? `WHERE ${ whereStatements }` : '';

        // ORDER BY id DESC
        const order = opt.order && Object.keys(opt.order).length
            ? `ORDER BY ${ Object.entries(opt.order).map(([field, direction]) => `${ Mysql.#quoteIdentifier(field) } ${ direction === 1 ? 'ASC' : 'DESC' }`).join(', ') }`
            : '';
        
        // LIMIT 10
        const limit = opt.limit ? `LIMIT ${ parseInt(opt.limit, 10) }` : '';
        
        // OFFSET 10
        const offset = opt.skip ? `OFFSET ${ parseInt(opt.skip, 10) }` : '';

        const lock = opt.forUpdate ? 'FOR UPDATE' : '';

        const sql = `SELECT ${view} FROM ${Mysql.#quoteIdentifier(table)} ${where} ${order} ${limit} ${offset} ${lock}`;
        // console.log(sql, values);
        return Mysql.#query(sql, values, context);
    }

    /**
     * Finds a single row or returns null when no row matches.
     */
    static async findOne(table, options = {}, context = {}) {
        const rows = await Mysql.find(table, {
            ...options,
            opt: {
                ...(options.opt || {}),
                limit: 1,
            },
        }, context);
        return rows[0] || null;
    }

    /**
     * Gets a single row by id or throws when it is missing.
     */
    static async get(table, id, context = {}) {
        const row = await Mysql.findOne(table, { filter: { id } }, context);
        if (!row) {
            throw new CustomError('Item not found.');
        }

        return row;
    }

    /**
     * Resets tables for integration tests while keeping SQL construction here.
     */
    static async resetTables(tables) {
        await Mysql.connect();
        await Mysql.#query('SET FOREIGN_KEY_CHECKS = 0', []);
        for (const table of tables) {
            await Mysql.#query(`TRUNCATE TABLE ${Mysql.#quoteIdentifier(table)}`, []);
        }
        await Mysql.#query('SET FOREIGN_KEY_CHECKS = 1', []);
    }

    /**
     * Runs an operation in a transaction using a dedicated pool connection.
     */
    static async withTransaction(operation) {
        if (typeof operation !== 'function') {
            throw new CustomError('Invalid transaction operation.');
        }

        await Mysql.connect();
        const connection = await Mysql.connection.getConnection();

        try {
            await connection.beginTransaction();
            const result = await operation({ connection });
            await connection.commit();
            return result;
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }

    /**
     * Wraps a raw SQL fragment so mysql2 preserves it during formatting.
     */
    static raw(str) {
        return { toSqlString: () => str };
    }

    /**
     * Expands raw SQL fragments before mysql2 executes the statement.
     */
    static formatRaw(sql, data) {
        const originalSql = sql;
        const pieces = sql.split('?');

        if (pieces.length > 1){
            let join = pieces.shift();
            
            try {
                data.forEach(d => {
                    if (d && d.toSqlString){
                        join += d.toSqlString();
                    }
                    else{
                        join += '?';
                    }
                    join += pieces.shift();
                });

                sql = join;
            }
            catch(error) {
                sql = originalSql;
            }

                data = Array.isArray(data)
                    ? data.filter(e => !e || !e.toSqlString)
                    : data;
        }
        
        return { sql, data };
    }

    /**
     * Delegates SQL formatting to the active mysql2 connection.
     */
    static format(sql, data) {
        if (!Mysql.connection) {
            throw new CustomError('Database not connected.');
        }
        return Mysql.connection.format(sql, data);
    }

    /**
     * Converts a timestamp-like value into MySQL DATETIME format.
     */
    static toDateTime(timestamp) {
        return new Date(timestamp).toISOString().replace('T', ' ').replace('Z', '');
    }

    /**
     * Builds a LIKE filter helper.
     */
    static like(str) {
        return { like: str };
    }

    /**
     * Builds a BETWEEN filter helper.
     */
    static between(a, b) {
        return { between: [ a, b ] };
    }

    /**
     * Builds a not equal filter helper.
     */
    static ne(value) {
        return { not: value };
    }

    /**
     * Builds a less-than filter helper.
     */
    static lt(value) {
        return { '<': value };
    }

    /**
     * Builds a greater-than filter helper.
     */
    static gt(value) {
        return { '>': value };
    }

    /**
     * Builds a less-than-or-equal filter helper.
     */
    static lte(value) {
        return { '<=': value };
    }

    /**
     * Builds a greater-than-or-equal filter helper.
     */
    static gte(value) {
        return { '>=': value };
    }

    /**
     * Dumps the configured database to a file.
     */
    static async dump(path, options={}) {
        return mysqldump({
            connection: Mysql.config,
            dumpToFile: path,
            ...options,
        });
    }
}
