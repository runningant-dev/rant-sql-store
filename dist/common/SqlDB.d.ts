import { Change, DataType, PropDef } from "rant-store";
import { QueryParam, QueryParams } from "./QueryParams";
export interface DBPropDef {
    name: string;
    dataType?: DataType;
    parts: string[];
}
export declare class NoDatabaseException {
}
export declare class SqlDB {
    connect(): Promise<void>;
    close(): Promise<void>;
    checkForBaseRequirements(): Promise<void>;
    getOne(sql: string, params?: any | any[]): Promise<any | undefined>;
    getAll(sql: string, params?: any | any[]): Promise<any[] | undefined>;
    exec(sql: string, params?: any | any[]): Promise<{
        rowCount: number;
    }>;
    tableExists(name: string): Promise<boolean>;
    getTableColumns(name: string): Promise<any[] | undefined>;
    establishBaseRequirements(): Promise<void>;
    createContainer(options: {
        name: string;
    }): Promise<void>;
    getSearchTableName(container: string): string;
    searchTableExists(container: string): Promise<boolean>;
    parseSearchWithin(searchWithin: PropDef[] | undefined): DBPropDef[];
    logChange(container: string, key: string, change: Change): Promise<void>;
    createSearchTable(name: string): Promise<void>;
    getUserTables(): Promise<any[] | undefined>;
    formatParamName(p: QueryParam): string;
    prepareParams(q: QueryParams): any;
    encodeName(name: string): string;
}