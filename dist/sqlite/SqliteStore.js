"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqliteStore = void 0;
const SqlStore_1 = require("../common/SqlStore");
const SqliteDB_1 = require("./SqliteDB");
class SqliteStore extends SqlStore_1.SqlStore {
    filename;
    constructor(filename) {
        super();
        this.filename = filename;
    }
    async connect() {
        const db = new SqliteDB_1.SqliteDB({
            filename: this.filename,
        });
        await db.connect();
        this.db = db;
        await db.checkForBaseRequirements();
    }
}
exports.SqliteStore = SqliteStore;
