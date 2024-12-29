"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MSSQLDB = void 0;
const mssql_1 = require("mssql");
const SqlDB_1 = require("../common/SqlDB");
const QueryParams_1 = require("../common/QueryParams");
const rant_utils_1 = require("rant-utils");
const log_1 = require("../log");
class MSSQLDB extends SqlDB_1.SqlDB {
    config;
    constructor(options) {
        super();
        this.options.dataTypes = {
            small: "nvarchar(200)",
            large: "ntext",
            maxSearchable: "nvarchar(1000)",
            autoInc: "bigint identity(1,1)",
            int: "int",
        };
        this.config = options;
    }
    async connect() {
        await (0, mssql_1.connect)(this.config);
    }
    async close() {
    }
    async exec(sql, params) {
        (0, log_1.info)(`exec: ${sql}`);
        return await new Promise((resolve, reject) => {
            const req = new mssql_1.Request();
            this.setParams(req, params);
            req.query(sql, (err, recordset) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve({
                        rowCount: (recordset && recordset.rowsAffected && recordset.rowsAffected.length > 0) ? recordset.rowsAffected[0] : 0,
                    });
                }
            });
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
                req.input(m, mssql_1.TYPES.NVarChar, val);
            }
            else if (Number.isInteger(val)) {
                req.input(m, mssql_1.TYPES.Int, val);
            }
            else if (val === true) {
                req.input(m, mssql_1.TYPES.SmallInt, 1);
            }
            else if (val === false) {
                req.input(m, mssql_1.TYPES.SmallInt, 0);
            }
            else if (!Number.isNaN(val)) {
                req.input(m, mssql_1.TYPES.Float, val);
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
        (0, log_1.info)(`exec: ${sql}`);
        return await new Promise((resolve, reject) => {
            const rows = [];
            const req = new mssql_1.Request();
            this.setParams(req, params);
            req.query(sql, (err, recordset) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(recordset ? recordset.recordset : []);
                }
            });
            // req.on("row", (cols) => {
            //     const row = {} as any;
            //     for(let col of cols) {
            //         row[col.metadata.colName] = col.value;
            //     }
            //     rows.push(row);
            // });
            // this.db.execSql(req);
        });
    }
    async tableExists(name) {
        const q = new QueryParams_1.QueryParams(this);
        const pName = q.add("name", name);
        const sql = `SELECT table_name as name from information_schema.tables WHERE table_name = ${this.formatParamName(pName)}`;
        (0, log_1.info)(sql);
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
        return `[${name.replace("]", "")}]`;
    }
    getLimitSql(maxRows, startingOffset) {
        return (`
			OFFSET ${startingOffset > 0 ? startingOffset : 0} ROWS
			FETCH NEXT ${maxRows} ROWS ONLY
		`);
    }
}
exports.MSSQLDB = MSSQLDB;
