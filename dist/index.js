"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const MSSQLStore_1 = require("./mssql/MSSQLStore");
__exportStar(require("./postgres/PostgresDB"), exports);
__exportStar(require("./postgres/PostgresStore"), exports);
__exportStar(require("./postgres/PostgresStoreFactory"), exports);
__exportStar(require("./sqlite/SqliteDB"), exports);
__exportStar(require("./sqlite/SqliteStore"), exports);
__exportStar(require("./sqlite/SqliteStoreFactory"), exports);
__exportStar(require("./mssql/MSSQLDB"), exports);
__exportStar(require("./mssql/MSSQLStore"), exports);
__exportStar(require("./mssql/MSSQLStoreFactory"), exports);
const dotenv_1 = __importDefault(require("dotenv"));
(async () => {
    dotenv_1.default.config();
    const store = new MSSQLStore_1.MSSQLStore();
    await store.connect();
    const results = await store.search({
        container: "user",
        qry: "email like '%guard%'",
        returnType: "ids",
        //roles: false,
    });
    console.dir(results);
    await store.close();
})();
