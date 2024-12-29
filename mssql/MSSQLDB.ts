import { connect, config, Request, TYPES } from "mssql";

import { SqlDB } from "../common/SqlDB";
import { QueryParam, QueryParams } from "../common/QueryParams";
import { isString } from "rant-utils";
import { info } from "../log";

export class MSSQLDB extends SqlDB {

    config: config;

    constructor(options: config) {
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
        await connect(this.config);
    }

    async close() {

    }

    async exec(sql: string, params?: any[]) {

        info(`exec: ${sql}`);

        return await new Promise<{
            rowCount: number,
        }>((resolve, reject) => {

            const req = new Request();
            this.setParams(req, params);

            req.query(sql, (err, recordset) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        rowCount: (recordset && recordset.rowsAffected && recordset.rowsAffected.length > 0) ? recordset.rowsAffected[0] : 0,
                    })
                }
            });

        });

    };

    setParams(req: Request, params?: any) {
        // setup the params
        if (!params) return;

        for(var m in params) {
            const val = params[m];
            if (isString(val)) {
                req.input(m, TYPES.NVarChar, val);

            } else if (Number.isInteger(val)) {
                req.input(m, TYPES.Int, val);

            } else if (val === true) {
                req.input(m, TYPES.SmallInt, 1);
            } else if (val === false) {
                req.input(m, TYPES.SmallInt, 0);

            } else if (!Number.isNaN(val)) {
                req.input(m, TYPES.Float, val);

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

        info(`exec: ${sql}`);

        return await new Promise<any[]>((resolve, reject) => {
            const rows = [] as any[];

            const req = new Request();
            this.setParams(req, params);

            req.query(sql, (err, recordset) => {
                if (err) {
                    reject(err);
                } else {
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

    async tableExists(name: string) {
        const q = new QueryParams(this);
        const pName = q.add("name", name);

        const sql = `SELECT table_name as name from information_schema.tables WHERE table_name = ${this.formatParamName(pName)}`;
        info(sql)

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
        return `[${name.replace("]", "")}]`;
    }

	getLimitSql(maxRows: number, startingOffset?: number) {
		return (`
			OFFSET ${startingOffset! > 0 ? startingOffset : 0} ROWS
			FETCH NEXT ${maxRows} ROWS ONLY
		`);
	}

}
