import { SqlStore } from "../common/SqlStore";
export declare class PostgresStore extends SqlStore {
    usePool: boolean;
    constructor(options?: {
        usePool?: boolean;
    });
    connect(): Promise<void>;
    createIndex(searchTableName: string, propName: string): Promise<void>;
}
