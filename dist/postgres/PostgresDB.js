"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresDB = void 0;
// import { Client } from "pg";
const SqlDB_1 = require("../common/SqlDB");
const QueryParams_1 = require("../common/QueryParams");
const pg_1 = require("pg");
class PostgresDB extends SqlDB_1.SqlDB {
    // db: Client;
    db;
    constructor(options) {
        super();
        // open the connection
        if (options.usePool) {
            this.db = new pg_1.Pool({
                max: 20,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
                ...options,
            });
        }
        else {
            this.db = new pg_1.Client(options);
        }
    }
    async connect() {
        await this.db.connect();
    }
    async close() {
        await this.db.end();
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
        console.log("PostgresDB.getAll() -> " + sql);
        console.dir(params);
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
        console.log("tableExists (" + name + ") result: " + (exists ? "Y" : "N"));
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
            let v = p.value;
            // ensure bools are 1 or 0
            if (v === true)
                v = 1;
            if (v === false)
                v = 0;
            result.push(v);
        }
        return result;
    }
    encodeName(name) {
        return `"${name.replace('"', '')}"`;
    }
    getLimitSql(maxRows, startingOffset) {
        return (` LIMIT ${maxRows} ${startingOffset >= 0 ? (`OFFSET ${startingOffset}`) : ""}`);
    }
}
exports.PostgresDB = PostgresDB;
