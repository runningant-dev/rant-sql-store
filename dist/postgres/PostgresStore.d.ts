import { SqlStore } from "../common/SqlStore";
export declare class PostgresStore extends SqlStore {
    constructor();
    connect(): Promise<void>;
}
