"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresStoreFactory = void 0;
const PostgresStore_1 = require("./PostgresStore");
function PostgresStoreFactory() {
    return {
        create: async function () {
            const store = new PostgresStore_1.PostgresStore();
            await store.connect();
            return store;
        },
        destroy: async function (store) {
            await store.close();
        },
    };
}
exports.PostgresStoreFactory = PostgresStoreFactory;
