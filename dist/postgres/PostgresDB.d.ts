import { SqlDB } from "../common/SqlDB";
import { QueryParam, QueryParams } from "../common/QueryParams";
import { Client, Pool } from "pg";
export declare class PostgresDB extends SqlDB {
    db: Pool | Client;
    constructor(options: any);
    connect(): Promise<void>;
    close(): Promise<void>;
    exec(sql: string, params?: any[]): Promise<{
        rowCount: number;
    }>;
    getOne(sql: string, params?: any[]): Promise<any | undefined>;
    getAll(sql: string, params?: any[]): Promise<any[] | undefined>;
    tableExists(name: string): Promise<boolean>;
    getUserTables(): Promise<any[] | undefined>;
    getTableColumns(tableName: string): Promise<any[] | undefined>;
    formatParamName(p: QueryParam): string;
    prepareParams(q: QueryParams): any[];
    encodeName(name: string): string;
    getLimitSql(maxRows: number, startingOffset?: number): string;
}
