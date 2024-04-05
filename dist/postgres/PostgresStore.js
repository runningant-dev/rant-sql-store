"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgresStore = void 0;
const PostgresDB_1 = require("./PostgresDB");
const SqlStore_1 = require("../common/SqlStore");
const rant_utils_1 = require("rant-utils");
const SqlDB_1 = require("../common/SqlDB");
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
    async createIndex(searchTableName, propName) {
        if (!this.db)
            throw new SqlDB_1.NoDatabaseException();
        const sql = `
			CREATE INDEX 
			${this.db.encodeName("idx_" + searchTableName + "_" + propName)} 
			ON ${this.db.encodeName(searchTableName)}
			USING btree (
				LOWER(${this.db.encodeName(propName)})
			);
		`;
        console.log(sql);
        await this.db.exec(sql);
    }
}
exports.PostgresStore = PostgresStore;
