"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MSSQLStoreFactory = void 0;
const MSSQLStore_1 = require("./MSSQLStore");
function MSSQLStoreFactory() {
    return {
        create: async function () {
            const store = new MSSQLStore_1.MSSQLStore();
            await store.connect();
            return store;
        },
        destroy: async function (store) {
            await store.close();
        },
    };
}
exports.MSSQLStoreFactory = MSSQLStoreFactory;
