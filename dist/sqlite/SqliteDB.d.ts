import { SqlDB } from "../common/SqlDB";
import { QueryParam, QueryParams } from "../common/QueryParams";
export declare class SqliteDB extends SqlDB {
    filename: string;
    db: any;
    constructor(options: {
        filename: string;
    });
    connect(): Promise<void>;
    close(): Promise<any>;
    exec(sql: string, params?: any): Promise<any>;
    getOne(sql: string, params?: any[]): Promise<any | undefined>;
    getAll(sql: string, params?: any | any[]): Promise<any>;
    tableExists(name: string): Promise<boolean>;
    getUserTables(): Promise<any>;
    getTableColumns(tableName: string): Promise<any>;
    formatParamName(p: QueryParam): string;
    prepareParams(q: QueryParams): any;
    encodeName(name: string): string;
}
