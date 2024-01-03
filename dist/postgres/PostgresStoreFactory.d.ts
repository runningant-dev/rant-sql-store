import { Store } from "rant-store";
import { PostgresStore } from "./PostgresStore";
export declare function PostgresStoreFactory(): {
    create: () => Promise<PostgresStore>;
    destroy: (store: Store) => Promise<void>;
};
