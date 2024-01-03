import { Store } from "rant-store";
import { PostgresStore } from "./PostgresStore";

export function PostgresStoreFactory() {
    return {
        create: async function() {
            const store = new PostgresStore();
            await store.connect();
            return store;        
        },
        destroy: async function(store: Store) {
            await store.close();
        },
    }
}
