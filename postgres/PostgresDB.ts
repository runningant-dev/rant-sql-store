import { Client } from "pg";
import { NoDatabaseException, SqlDB } from "../common/SqlDB";
import { QueryParam, QueryParams } from "../common/QueryParams";

export class PostgresDB extends SqlDB {

    db: Client;

    constructor(options: any) {
        super();
        
        // open the connection
        this.db = new Client(options);
    }

    async connect() {
        return this.db.connect();
    }

    async close() {
        return this.db.end();
    }

    async exec(sql: string, params?: any[]) {
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
        const queryResult = await this.db.query(sql, params);
        if (!queryResult || queryResult.rows.length <= 0) return undefined;
        return queryResult.rows;
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
            result.push(p.value);
        }
        return result;
    }

    encodeName(name: string) {
        return `"${name}"`;
    }

}
