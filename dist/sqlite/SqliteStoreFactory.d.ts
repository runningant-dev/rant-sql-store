import { Store } from "rant-store";
import { SqliteStore } from "./SqliteStore";
export declare function SqliteStoreFactory(filename: string): {
    create: () => Promise<SqliteStore>;
    destroy: (store: Store) => Promise<void>;
};
