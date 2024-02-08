"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MSSQLStore = void 0;
const MSSQLDB_1 = require("./MSSQLDB");
const SqlStore_1 = require("../common/SqlStore");
class MSSQLStore extends SqlStore_1.SqlStore {
    constructor() {
        super();
    }
    async connect() {
        const env = process.env;
        const db = new MSSQLDB_1.MSSQLDB({
            server: env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE,
            pool: {
                max: 20,
                min: 0,
                idleTimeoutMillis: 5 * 60 * 1000,
            },
            options: {
                encrypt: true,
                trustServerCertificate: false // change to true for local dev / self-signed certs
            }
        });
        await db.connect();
        this.db = db;
        await db.checkForBaseRequirements();
    }
}
exports.MSSQLStore = MSSQLStore;
