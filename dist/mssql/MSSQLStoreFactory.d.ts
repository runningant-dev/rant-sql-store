import { MSSQLStore } from "./MSSQLStore";
export declare function MSSQLStoreFactory(): {
    create: () => Promise<MSSQLStore>;
    destroy: (store: MSSQLStore) => Promise<void>;
};
