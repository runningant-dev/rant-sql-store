"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MSSQLDB = void 0;
const tedious_1 = require("tedious");
// http://tediousjs.github.io/tedious/api-request.html
const SqlDB_1 = require("../common/SqlDB");
const QueryParams_1 = require("../common/QueryParams");
const rant_utils_1 = require("rant-utils");
class MSSQLDB extends SqlDB_1.SqlDB {
    db;
    constructor(options) {
        super();
        this.options.dataTypes = {
            small: "nvarchar(200)",
            large: "ntext",
            autoInc: "bigint identity(1,1)",
        };
        // open the connection
        this.db = new tedious_1.Connection(options);
    }
    async connect() {
        const result = await new Promise((resolve, reject) => {
            this.db.on("connect", err => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(this.db);
                }
            });
            this.db.connect();
        });
    }
    async close() {
        return this.db.close();
    }
    async exec(sql, params) {
        console.log(`exec: ${sql}`);
        return await new Promise((resolve, reject) => {
            let req = new tedious_1.Request(sql, (err, rowCount) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve({
                        rowCount,
                    });
                }
            });
            this.setParams(req, params);
            this.db.execSql(req);
        });
    }
    ;
    setParams(req, params) {
        // setup the params
        if (!params)
            return;
        for (var m in params) {
            const val = params[m];
            if ((0, rant_utils_1.isString)(val)) {
                req.addParameter(m, tedious_1.TYPES.NVarChar, val);
            }
            else if (Number.isInteger(val)) {
                req.addParameter(m, tedious_1.TYPES.Int, val);
            }
            else if (val === true) {
                req.addParameter(m, tedious_1.TYPES.SmallInt, 1);
            }
            else if (val === false) {
                req.addParameter(m, tedious_1.TYPES.SmallInt, 0);
            }
            else if (!Number.isNaN(val)) {
                req.addParameter(m, tedious_1.TYPES.Float, val);
            }
            else {
                // ignore any other types for now
            }
        }
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
        // const queryResult = await this.db.query(sql, params);
        // if (!queryResult || queryResult.rows.length <= 0) return undefined;
        // return queryResult.rows;
        console.log(`exec: ${sql}`);
        return await new Promise((resolve, reject) => {
            const rows = [];
            let req = new tedious_1.Request(sql, (err, rowCount) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(rows);
                }
            });
            this.setParams(req, params);
            req.on("row", (cols) => {
                const row = {};
                for (let col of cols) {
                    row[col.metadata.colName] = col.value;
                }
                rows.push(row);
            });
            this.db.execSql(req);
        });
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
            where table_schema not in ('sys')
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
        return "@" + p.name;
    }
    prepareParams(q) {
        const result = {};
        for (let p of q.items) {
            result[p.name] = p.value;
        }
        return result;
    }
    encodeName(name) {
        return `[${name}]`;
    }
}
exports.MSSQLDB = MSSQLDB;
