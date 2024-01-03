import { Change, DataType, PropDef } from "rant-store";
import { formatDateTime } from "rant-utils"
import { QueryParam, QueryParams } from "./QueryParams";

export interface DBPropDef {
    name: string,
    dataType?: DataType,
    parts: string[],
}

export class NoDatabaseException {

}

export class SqlDB {

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
    async getOne(sql: string, params?: any | any[]): Promise<any | undefined> {
        return undefined;
    }

    // always return valid array if count > 0, else undefined
    async getAll(sql: string, params?: any | any[]): Promise<any[] | undefined> {
        return [] as any[];
    }

    async exec(sql: string, params?: any | any[]) {
        return {
            rowCount: 0,
        }
    }

    async tableExists(name: string) {
        return false;
    }

    async getTableColumns(name: string): Promise<any[] | undefined> {
        return undefined;
    }

    async establishBaseRequirements() {

    }

    async createContainer(options: {
        name: string,
    }) {
        const name = options.name.toLowerCase();

        await this.exec(`CREATE TABLE "${name}" (key TEXT NOT NULL PRIMARY KEY, value TEXT, meta TEXT, version INT);`);
        await this.exec(`CREATE UNIQUE INDEX idx_${name}_key ON "${name}" (key);`);
        await this.exec(`INSERT INTO schema (container) VALUES ('${name}');`);
    }

    getSearchTableName(container: string) {
        return container + "_search";
    }

    async searchTableExists(container: string) {
        const searchTableName = this.getSearchTableName(container);
        return this.tableExists(searchTableName);
    }

    parseSearchWithin(searchWithin: PropDef[] | undefined) {
        if (!searchWithin) return [];

        const props: DBPropDef[] = [];
        for(let i=0;i<searchWithin.length;i++) {
            const sw = searchWithin[i];

            props.push({
                name: sw.name.replace(".", "_"),
                parts: sw.name.split("."),
                dataType: sw.dataType,
            });
        }
        return props;
    }

    async logChange(container: string, key: string, change: Change) {
        const params = new QueryParams(this);
        params.add("container", container);
        params.add("key", key);
        params.add("change", JSON.stringify(change));
        params.add("timestamp", formatDateTime(new Date()));

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
        const result = this.exec(
            sql, 
            params.prepare(),
        );
    }

    async createSearchTable(name: string) {

    }

    async getUserTables(): Promise<any[] | undefined> {
        return undefined;
    }


    formatParamName(p: QueryParam) {
        return p.name;
    }

    prepareParams(q: QueryParams): any {
        return undefined;
    }

    encodeName(name: string) {
        return name;
    }

};