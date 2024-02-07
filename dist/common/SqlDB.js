"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SqlDB = exports.NoDatabaseException = void 0;
const rant_utils_1 = require("rant-utils");
const QueryParams_1 = require("./QueryParams");
class NoDatabaseException {
}
exports.NoDatabaseException = NoDatabaseException;
class SqlDB {
    options = {
        dataTypes: {
            small: "TEXT",
            large: "TEXT",
            maxSearchable: "TEXT",
            autoInc: "bigserial",
            int: "INT",
        }
    };
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
        // could be executed in single query, but sqlite doesn't appreciate that 
        await this.exec(`
            CREATE TABLE ${this.encodeName("schema")} (
                container ${this.options.dataTypes.small} NOT NULL, 
                indexes ${this.options.dataTypes.large}, 
                sensitive ${this.options.dataTypes.large}, 
                updated ${this.options.dataTypes.small});
        `);
        await this.exec(`
            CREATE UNIQUE INDEX idx_schema_container ON ${this.encodeName("schema")} (container);
        `);
        await this.exec(`            
            CREATE TABLE changes (
                change_id ${this.options.dataTypes.autoInc} primary key, 
                container ${this.options.dataTypes.small} NOT NULL, 
                id ${this.options.dataTypes.small}, 
                change ${this.options.dataTypes.large} NOT NULL, 
                timestamp ${this.options.dataTypes.small}
            ); 
        `);
    }
    sanitizeName(name) {
        return name.replace(/([^a-z0-9_]+)/gi, "").toLowerCase();
    }
    async createContainer(options) {
        const name = this.sanitizeName(options.name);
        await this.exec(`
            CREATE TABLE ${this.encodeName(name)} (
                [id] ${this.options.dataTypes.small} NOT NULL PRIMARY KEY, 
                value ${this.options.dataTypes.large}, 
                meta ${this.options.dataTypes.large}, 
                version INT
            );`);
        await this.exec(`CREATE UNIQUE INDEX idx_${name}_id ON ${this.encodeName(name)} ([id]);`);
        await this.exec(`INSERT INTO ${this.encodeName("schema")} (container) VALUES ('${name}');`);
    }
    getSearchTableName(container) {
        return container + "_search";
    }
    async searchTableExists(container) {
        const searchTableName = this.getSearchTableName(container);
        return this.tableExists(searchTableName);
    }
    parseIndexes(indexes) {
        if (!indexes)
            return [];
        const props = [];
        for (let i = 0; i < indexes.length; i++) {
            const sw = indexes[i];
            props.push({
                name: sw.name.replace(".", "_"),
                parts: sw.name.split("."),
                dataType: sw.dataType,
            });
        }
        return props;
    }
    async logChange(container, id, change) {
        const params = new QueryParams_1.QueryParams(this);
        params.add("container", container);
        params.add("id", id);
        params.add("change", JSON.stringify(change));
        params.add("timestamp", (0, rant_utils_1.formatDateTime)(new Date()));
        const sql = `
            INSERT INTO changes (
                container, id, change, timestamp
            )
            VALUES (
                ${params.name("container")},
                ${params.name("id")},
                ${params.name("change")},
                ${params.name("timestamp")}
            )
        `;
        // console.log(sql);
        const result = await this.exec(sql, params.prepare());
    }
    async createSearchTable(searchTableName) {
        await this.exec(`CREATE TABLE ${this.encodeName(searchTableName)} ([id] ${this.options.dataTypes.small} NOT NULL PRIMARY KEY)`);
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
