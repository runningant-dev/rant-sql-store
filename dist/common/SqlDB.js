"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqlDB = exports.NoDatabaseException = void 0;
const rant_utils_1 = require("rant-utils");
const QueryParams_1 = require("./QueryParams");
class NoDatabaseException {
}
exports.NoDatabaseException = NoDatabaseException;
class SqlDB {
    async connect() {
    }
    async close() {
    }
    async checkForBaseRequirements() {
        // check for base requirements
        if (!(await this.tableExists("schema"))) {
            await this.establishBaseRequirements();
        }
    }
    // if found return object {} with props being the cols from table
    async getOne(sql, params) {
        return undefined;
    }
    // always return valid array if count > 0, else undefined
    async getAll(sql, params) {
        return [];
    }
    async exec(sql, params) {
        return {
            rowCount: 0,
        };
    }
    async tableExists(name) {
        return false;
    }
    async getTableColumns(name) {
        return undefined;
    }
    async establishBaseRequirements() {
    }
    async createContainer(options) {
        const name = options.name.toLowerCase();
        await this.exec(`CREATE TABLE "${name}" (key TEXT NOT NULL PRIMARY KEY, value TEXT, meta TEXT, version INT);`);
        await this.exec(`CREATE UNIQUE INDEX idx_${name}_key ON "${name}" (key);`);
        await this.exec(`INSERT INTO schema (container) VALUES ('${name}');`);
    }
    getSearchTableName(container) {
        return container + "_search";
    }
    async searchTableExists(container) {
        const searchTableName = this.getSearchTableName(container);
        return this.tableExists(searchTableName);
    }
    parseSearchWithin(searchWithin) {
        if (!searchWithin)
            return [];
        const props = [];
        for (let i = 0; i < searchWithin.length; i++) {
            const sw = searchWithin[i];
            props.push({
                name: sw.name.replace(".", "_"),
                parts: sw.name.split("."),
                dataType: sw.dataType,
            });
        }
        return props;
    }
    async logChange(container, key, change) {
        const params = new QueryParams_1.QueryParams(this);
        params.add("container", container);
        params.add("key", key);
        params.add("change", JSON.stringify(change));
        params.add("timestamp", (0, rant_utils_1.formatDateTime)(new Date()));
        const sql = `
            INSERT INTO changes (
                container, key, change, timestamp
            )
            VALUES (
                ${params.name("container")},
                ${params.name("key")},
                ${params.name("change")},
                ${params.name("timestamp")}
            )
        `;
        // console.log(sql);
        const result = this.exec(sql, params.prepare());
    }
    async createSearchTable(name) {
    }
    async getUserTables() {
        return undefined;
    }
    formatParamName(p) {
        return p.name;
    }
    prepareParams(q) {
        return undefined;
    }
    encodeName(name) {
        return name;
    }
}
exports.SqlDB = SqlDB;
;
