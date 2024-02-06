"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqliteDB = void 0;
const sqlite_1 = require("sqlite");
const sqlite3_1 = require("sqlite3");
const SqlDB_1 = require("../common/SqlDB");
const QueryParams_1 = require("../common/QueryParams");
class SqliteDB extends SqlDB_1.SqlDB {
    filename;
    db;
    constructor(options) {
        super();
        this.filename = options.filename;
    }
    async connect() {
        this.db = await (0, sqlite_1.open)({
            filename: this.filename,
            driver: sqlite3_1.Database,
        });
    }
    async close() {
        return this.db?.close();
    }
    async exec(sql, params) {
        console.log("SqliteDB.exec(): " + sql + ", with params: " + JSON.stringify(params));
        if (!this.db)
            throw new SqlDB_1.NoDatabaseException();
        const result = await this.db.run(sql, params);
        result.rowCount = result.changes;
        return result;
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
        const result = await this.db.all(sql, params);
        if (result && result.length <= 0)
            return undefined;
        return result;
    }
    async tableExists(name) {
        const q = new QueryParams_1.QueryParams(this);
        const pName = q.add("name", name);
        const sql = `SELECT name from sqlite_master where type='table' and name = ${this.formatParamName(pName)}`;
        console.log(sql);
        const exists = await this.getOne(sql, this.prepareParams(q));
        return (exists !== undefined);
    }
    async getUserTables() {
        return await this.getAll(`
            SELECT name 
            from sqlite_master 
            where type='table' and name <> 'sqlite_sequence'
        `);
    }
    async getTableColumns(tableName) {
        console.log("SqliteDB.getTableColumns()");
        const params = new QueryParams_1.QueryParams(this);
        params.add("tableName", tableName);
        return this.getAll(`
            SELECT 
                p.name, p.type
            FROM sqlite_master m
            left outer join pragma_table_info((m.name)) p
                on m.name <> p.name
            WHERE m.name = ${params.name("tableName")}
        `, params.prepare());
    }
    formatParamName(p) {
        return ":" + (p.name);
    }
    prepareParams(q) {
        const result = {};
        for (let p of q.items) {
            result[":" + p.name] = p.value;
        }
        return result;
    }
    encodeName(name) {
        return `"${name}"`;
    }
}
exports.SqliteDB = SqliteDB;
