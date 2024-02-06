import { SqlStore } from "../common/SqlStore";
export declare class MSSQLStore extends SqlStore {
    constructor();
    connect(): Promise<void>;
}
