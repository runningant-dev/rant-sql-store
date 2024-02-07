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
    options: {
        dataTypes: {
            small: string;
            large: string;
            maxSearchable: string;
            autoInc: string;
            int: string;
        };
    };
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
    sanitizeName(name: string): string;
    createContainer(options: {
        name: string;
    }): Promise<void>;
    getSearchTableName(container: string): string;
    searchTableExists(container: string): Promise<boolean>;
    parseIndexes(indexes: PropDef[] | undefined): DBPropDef[];
    logChange(container: string, id: string, change: Change): Promise<void>;
    createSearchTable(searchTableName: string): Promise<void>;
    getUserTables(): Promise<any[] | undefined>;
    formatParamName(p: QueryParam): string;
    prepareParams(q: QueryParams): any;
    encodeName(name: string): string;
}
