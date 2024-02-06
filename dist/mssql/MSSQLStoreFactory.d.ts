import { Store } from "rant-store";
import { MSSQLStore } from "./MSSQLStore";
export declare function MSSQLStoreFactory(): {
    create: () => Promise<MSSQLStore>;
    destroy: (store: Store) => Promise<void>;
};
