// import { Store } from "rant-store";
// import { SqliteStore } from "./SqliteStore";

// export function SqliteStoreFactory(filename: string) {
//     return {
//         create: async function() {
//             const store = new SqliteStore(filename);
//             await store.connect();
//             return store;        
//         },
//         destroy: async function(store: Store) {
//             await store.close();
//         },
//     }
// }
