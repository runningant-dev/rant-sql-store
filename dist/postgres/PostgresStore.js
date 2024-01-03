"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresStore = void 0;
const PostgresDB_1 = require("./PostgresDB");
const SqlStore_1 = require("../common/SqlStore");
class PostgresStore extends SqlStore_1.SqlStore {
    constructor() {
        super();
    }
    async connect() {
        const db = new PostgresDB_1.PostgresDB({
            host: "localhost",
            port: 5432,
            user: "postgres",
            password: "postgres",
            database: "store",
            ssl: false,
        });
        await db.connect();
        this.db = db;
        await db.checkForBaseRequirements();
    }
}
exports.PostgresStore = PostgresStore;
