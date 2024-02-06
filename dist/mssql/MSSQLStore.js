"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MSSQLStore = void 0;
const MSSQLDB_1 = require("./MSSQLDB");
const SqlStore_1 = require("../common/SqlStore");
const rant_utils_1 = require("rant-utils");
class MSSQLStore extends SqlStore_1.SqlStore {
    constructor() {
        super();
    }
    async connect() {
        const env = process.env;
        const db = new MSSQLDB_1.MSSQLDB({
            server: env.DB_HOST,
            authentication: {
                type: "default",
                options: {
                    userName: env.DB_USER,
                    password: env.DB_PASSWORD,
                },
            },
            options: {
                database: env.DB_DATABASE,
                port: (0, rant_utils_1.toInt)(env.DB_PORT),
            }
        });
        await db.connect();
        this.db = db;
        await db.checkForBaseRequirements();
    }
}
exports.MSSQLStore = MSSQLStore;
