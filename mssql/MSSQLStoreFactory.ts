import { Store } from "rant-store";
import { MSSQLStore } from "./MSSQLStore";

export function MSSQLStoreFactory() {
    return {
        create: async function() {
            const store = new MSSQLStore();
            await store.connect();
            return store;        
        },
        destroy: async function(store: MSSQLStore) {
            await store.close();
        },
    }
}
