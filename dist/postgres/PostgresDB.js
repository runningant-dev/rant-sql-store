"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresDB = void 0;
const pg_1 = require("pg");
const SqlDB_1 = require("../common/SqlDB");
const QueryParams_1 = require("../common/QueryParams");
class PostgresDB extends SqlDB_1.SqlDB {
    db;
    constructor(options) {
        super();
        // open the connection
        this.db = new pg_1.Client(options);
    }
    async connect() {
        return this.db.connect();
    }
    async close() {
        return this.db.end();
    }
    async exec(sql, params) {
        const result = await this.db.query(sql, params);
        return {
            rowCount: (result && result.rowCount !== null) ? result.rowCount : 0,
        };
    }
    async getOne(sql, params) {
        const result = await this.getAll(sql, params);
        if (result) {
            return result[0];
        }
        else {
            return undefined;
        }
    }
    async getAll(sql, params) {
        const queryResult = await this.db.query(sql, params);
        if (!queryResult || queryResult.rows.length <= 0)
            return undefined;
        return queryResult.rows;
    }
    async tableExists(name) {
        const q = new QueryParams_1.QueryParams(this);
        const pName = q.add("name", name);
        const sql = `SELECT table_name as name from information_schema.tables WHERE table_name = ${this.formatParamName(pName)}`;
        console.log(sql);
        const exists = await this.getOne(sql, this.prepareParams(q));
        return (exists !== undefined);
    }
    async getUserTables() {
        return await this.getAll(`
            select table_name as name
            from information_schema.tables
            where table_schema not in ('pg_catalog', 'information_schema')        
        `);
    }
    async getTableColumns(tableName) {
        const params = new QueryParams_1.QueryParams(this);
        params.add("tableName", tableName);
        const result = await this.getAll(`
            SELECT column_name as name, data_type as type
            FROM information_schema.columns
            WHERE table_name = ${params.name("tableName")};
        `, params.prepare());
        return result;
    }
    formatParamName(p) {
        return "$" + (p.index + 1);
    }
    prepareParams(q) {
        const result = [];
        for (let p of q.items) {
            result.push(p.value);
        }
        return result;
    }
    encodeName(name) {
        return `"${name}"`;
    }
}
exports.PostgresDB = PostgresDB;
