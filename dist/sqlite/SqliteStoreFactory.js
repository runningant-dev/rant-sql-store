"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqliteStoreFactory = void 0;
const SqliteStore_1 = require("./SqliteStore");
function SqliteStoreFactory(filename) {
    return {
        create: async function () {
            const store = new SqliteStore_1.SqliteStore(filename);
            await store.connect();
            return store;
        },
        destroy: async function (store) {
            await store.close();
        },
    };
}
exports.SqliteStoreFactory = SqliteStoreFactory;
