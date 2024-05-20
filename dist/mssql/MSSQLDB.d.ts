import { config, Request } from "mssql";
import { SqlDB } from "../common/SqlDB";
import { QueryParam, QueryParams } from "../common/QueryParams";
export declare class MSSQLDB extends SqlDB {
    config: config;
    constructor(options: config);
    connect(): Promise<void>;
    close(): Promise<void>;
    exec(sql: string, params?: any[]): Promise<{
        rowCount: number;
    }>;
    setParams(req: Request, params?: any): void;
    getOne(sql: string, params?: any): Promise<any | undefined>;
    getAll(sql: string, params?: any): Promise<any[]>;
    tableExists(name: string): Promise<boolean>;
    getUserTables(): Promise<any[]>;
    getTableColumns(tableName: string): Promise<any[]>;
    formatParamName(p: QueryParam): string;
    prepareParams(q: QueryParams): any;
    encodeName(name: string): string;
    getLimitSql(maxRows: number, startingOffset?: number): string;
}
