import { SqlStore } from "../common/SqlStore";
export declare class SqliteStore extends SqlStore {
    filename: string;
    constructor(filename: string);
    connect(): Promise<void>;
}
