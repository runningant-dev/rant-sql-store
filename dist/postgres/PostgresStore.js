"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresStore = void 0;
const PostgresDB_1 = require("./PostgresDB");
const SqlStore_1 = require("../common/SqlStore");
const rant_utils_1 = require("rant-utils");
class PostgresStore extends SqlStore_1.SqlStore {
    constructor() {
        super();
    }
    async connect() {
        const env = process.env;
        const db = new PostgresDB_1.PostgresDB({
            host: env.DB_HOST,
            port: (0, rant_utils_1.toInt)(env.DB_PORT),
            user: env.DB_USER,
            password: env.DB_PASSWORD,
            database: env.DB_DATABASE,
            ssl: (env.DB_SSL === "true" ? true : false),
        });
        await db.connect();
        this.db = db;
        await db.checkForBaseRequirements();
    }
}
exports.PostgresStore = PostgresStore;
