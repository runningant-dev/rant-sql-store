import { SqlStore } from "../common/SqlStore";
export declare class PostgresStore extends SqlStore {
    constructor();
    connect(): Promise<void>;
    createIndex(searchTableName: string, propName: string): Promise<void>;
}
