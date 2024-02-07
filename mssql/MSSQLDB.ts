import { Connection, ConnectionConfig, Request, TYPES } from "tedious"

// http://tediousjs.github.io/tedious/api-request.html

import { NoDatabaseException, SqlDB } from "../common/SqlDB";
import { QueryParam, QueryParams } from "../common/QueryParams";
import { isString } from "rant-utils";

export class MSSQLDB extends SqlDB {

    db: Connection;

    constructor(options: ConnectionConfig) {
        super();

        this.options.dataTypes = {
            small: "nvarchar(200)",
            large: "ntext",
            maxSearchable: "nvarchar(1000)",
            autoInc: "bigint identity(1,1)",
            int: "int",
        };

        // open the connection
        this.db = new Connection(options);
    }

    async connect() {

        const result = await new Promise<Connection>((resolve, reject) => {

            this.db.on("connect", err => {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.db);
                }
            });

            this.db.connect();
        });

    }

    async close() {
        return this.db.close();
    }

    async exec(sql: string, params?: any[]) {

        console.log(`exec: ${sql}`);

        return await new Promise<{
            rowCount: number,
        }>((resolve, reject) => {

            let req = new Request(sql, (err, rowCount) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        rowCount,
                    });
                }       
            });

            this.setParams(req, params);

            this.db.execSql(req);

        });

    };

    setParams(req: Request, params?: any) {
        // setup the params
        if (!params) return;

        for(var m in params) {
            const val = params[m];
            if (isString(val)) {
                req.addParameter(m, TYPES.NVarChar, val);

            } else if (Number.isInteger(val)) {
                req.addParameter(m, TYPES.Int, val);

            } else if (val === true) {
                req.addParameter(m, TYPES.SmallInt, 1);
            } else if (val === false) {
                req.addParameter(m, TYPES.SmallInt, 0);

            } else if (!Number.isNaN(val)) {
                req.addParameter(m, TYPES.Float, val);

            } else {
                // ignore any other types for now

            }
        }

    }
    
    async getOne(sql: string, params?: any): Promise<any | undefined> {
        const result = await this.getAll(sql, params);
        if (result) {
            return result[0];
        } else {
            return undefined;
        }
    }

    async getAll(sql: string, params?: any) {
        // const queryResult = await this.db.query(sql, params);
        // if (!queryResult || queryResult.rows.length <= 0) return undefined;
        // return queryResult.rows;

        console.log(`exec: ${sql}`);

        return await new Promise<any[]>((resolve, reject) => {
            const rows = [] as any[];

            let req = new Request(sql, (err, rowCount) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }       
            });

            this.setParams(req, params);

            req.on("row", (cols) => {
                const row = {} as any;
                for(let col of cols) {
                    row[col.metadata.colName] = col.value;
                }
                rows.push(row);
            });

            this.db.execSql(req);

        });

    }

    async tableExists(name: string) {
        const q = new QueryParams(this);
        const pName = q.add("name", name);

        const sql = `SELECT table_name as name from information_schema.tables WHERE table_name = ${this.formatParamName(pName)}`;
        console.log(sql)

        const exists: any = await this.getOne(
            sql, 
            this.prepareParams(q)
        );

        return (exists !== undefined);
    }

    async getUserTables() {
        return await this.getAll(`
            select table_name as name
            from information_schema.tables
            where table_schema not in ('sys')
        `);
    }

    async getTableColumns(tableName: string) {
        const params = new QueryParams(this);
        params.add("tableName", tableName);

        const result: any[] = await this.getAll(`
            SELECT column_name as name, data_type as type
            FROM information_schema.columns
            WHERE table_name = ${params.name("tableName")};
        `, params.prepare());

        return result;
    }

    formatParamName(p: QueryParam) {
        return "@" + p.name;
    }

    prepareParams(q: QueryParams) {
        const result = {} as any;
        for(let p of q.items) {
            result[p.name] = p.value;
        }
        return result;
    }

    encodeName(name: string) {
        return `[${name}]`;
    }

}
