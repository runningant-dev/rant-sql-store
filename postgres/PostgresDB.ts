// import { Client } from "pg";
import { NoDatabaseException, SqlDB } from "../common/SqlDB";
import { QueryParam, QueryParams } from "../common/QueryParams";
import { Client, Pool } from "pg";
import { data, info } from "../log";

export class PostgresDB extends SqlDB {

    // db: Client;
	db: Pool | Client;

    constructor(options: any) {
        super();

        // open the connection
		if (options.usePool) {
			this.db = new Pool({
				max: 20,
				idleTimeoutMillis: 30000,
				connectionTimeoutMillis: 2000,
				...options,
			});
	
		} else {
	        this.db = new Client(options);

		}
        
    }

    async connect() {
        await this.db.connect();
    }

    async close() {
		await this.db.end();
    }

    async exec(sql: string, params?: any[]) {
		info("PostgresDB.exec()");
		data(sql);
		data(params);

		const result = await this.db.query(sql, params);
        return {
            rowCount: (result && result.rowCount !== null) ? result.rowCount : 0,
        };
    }
    

    async getOne(sql: string, params?: any[]): Promise<any | undefined> {
		const result = await this.getAll(sql, params);
        if (result) {
            return result[0];
        } else {
            return undefined;
        }
    }

    async getAll(sql: string, params?: any[]) {
		//info("PostgresDB.getAll()");
		data(sql);
		if (params !== undefined) data(params);

        const queryResult = await this.db.query(sql, params);
        if (!queryResult || queryResult.rows.length <= 0) return undefined;
        return queryResult.rows;
    }

    async tableExists(name: string) {
        const q = new QueryParams(this);
        const pName = q.add("name", name);

        const sql = `SELECT table_name as name from information_schema.tables WHERE table_name = ${this.formatParamName(pName)}`;
        // data(sql)

        const exists: any = await this.getOne(
            sql, 
            this.prepareParams(q)
        );

		info("tableExists (" + name + ") result: " + (exists ? "Y" : "N"));

        return (exists !== undefined);
    }

    async getUserTables() {
        return await this.getAll(`
            select table_name as name
            from information_schema.tables
            where table_schema not in ('pg_catalog', 'information_schema')        
        `);
    }

    async getTableColumns(tableName: string): Promise<any[] | undefined> {
        const params = new QueryParams(this);
        params.add("tableName", tableName);

        const result: any[] | undefined = await this.getAll(`
            SELECT column_name as name, data_type as type
            FROM information_schema.columns
            WHERE table_name = ${params.name("tableName")};
        `, params.prepare());

        return result;
    }
    
    formatParamName(p: QueryParam) {
        return "$" + (p.index + 1);
    }

    prepareParams(q: QueryParams) {
        const result = [];
        for(let p of q.items) {
			let v = p.value;
			
			// ensure bools are 1 or 0
			if (v === true) v = 1;
			if (v === false) v = 0;

            result.push(v);
        }
        return result;
    }

    encodeName(name: string) {
        return `"${name.replace('"', '')}"`;
    }

	getLimitSql(maxRows: number, startingOffset?: number) {
		return (
			` LIMIT ${maxRows} ${startingOffset! >= 0 ? (`OFFSET ${startingOffset}`) : ""}`
		);
	}

}
