import { open } from 'sqlite';
import { Database, Statement } from 'sqlite3';

import { NoDatabaseException, SqlDB } from "../common/SqlDB";
import { QueryParam, QueryParams } from "../common/QueryParams";

export class SqliteDB extends SqlDB {

    filename: string;
    db: any;

    constructor(options: {
        filename: string,
    }) {
        super();
        this.filename = options.filename;
    }

    async connect() {
        this.db = await open({
            filename: this.filename,
            driver: Database,
        });
    }

    async close() {
        return this.db?.close();
    }

    async exec(sql: string, params?: any) {
        console.log("SqliteDB.exec(): " + sql + ", with params: " + JSON.stringify(params));

        if (!this.db) throw new NoDatabaseException();

        const result = await this.db.run(sql, params);
        result.rowCount = result.changes;
        return result;
    }

    async getOne(sql: string, params?: any[]): Promise<any | undefined> {
        const result = await this.getAll(sql, params);
        if (result) {
            return result[0];
        } else {
            return undefined;
        }
    }

    async getAll(sql: string, params?: any | any[]) {
        const result = await this.db.all(sql, params);
        if (result && result.length <= 0) return undefined;
        return result;
    }

    async tableExists(name: string) {
        const q = new QueryParams(this);
        const pName = q.add("name", name);

        const sql = `SELECT name from sqlite_master where type='table' and name = ${this.formatParamName(pName)}`;
        console.log(sql)

        const exists: any = await this.getOne(
            sql, 
            this.prepareParams(q)
        );

        return (exists !== undefined);
    }

    async getUserTables() {
        return await this.getAll(`
            SELECT name 
            from sqlite_master 
            where type='table' and name <> 'sqlite_sequence'
        `);
    }

    async getTableColumns(tableName: string): Promise<any> {
        console.log("SqliteDB.getTableColumns()");

        const params = new QueryParams(this);
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

    formatParamName(p: QueryParam) {
        return ":" + (p.name);
    }

    prepareParams(q: QueryParams) {
        const result = {} as any;
        for(let p of q.items) {
            result[":" + p.name] = p.value;
        }
        return result;
    }

    encodeName(name: string) {
        return `"${name}"`;
    }

}
