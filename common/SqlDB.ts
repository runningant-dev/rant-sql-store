import { Change, DataType, PropDef } from "rant-store";
import { formatDatabaseDateTime } from "rant-utils"
import { QueryParam, QueryParams } from "./QueryParams";

export interface DBPropDef {
    name: string,
    dataType?: DataType,
    parts: string[],
}

export class NoDatabaseException {

}

export class SqlDB {

    options = {
        dataTypes: {
            small: "TEXT",
            large: "TEXT",
            maxSearchable: "TEXT",
            autoInc: "bigserial",
            int: "INT",
        }
    }

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

    sanitizeName(name: string) {
        return name.replace(/([^a-z0-9_]+)/gi, "").toLowerCase();
    }

    async createContainer(options: {
        name: string,
    }) {
        const name = this.sanitizeName(options.name);

        await this.exec(`
            CREATE TABLE ${this.encodeName(name)} (
                ${this.encodeName("id")} ${this.options.dataTypes.small} NOT NULL PRIMARY KEY, 
                value ${this.options.dataTypes.large}, 
                meta ${this.options.dataTypes.large}, 
                version INT
            );`);
        await this.exec(`INSERT INTO ${this.encodeName("schema")} (container) VALUES ('${name}');`);
    }

    getSearchTableName(container: string) {
        return container + "_search";
    }

    async searchTableExists(container: string) {
        const searchTableName = this.getSearchTableName(container);
        return this.tableExists(searchTableName);
    }

    parseIndexes(indexes: PropDef[] | undefined) {
        if (!indexes) return [];

        const props: DBPropDef[] = [];
        for(let i=0;i<indexes.length;i++) {
            const sw = indexes[i];

            props.push({
                name: sw.name.replace(".", "_"),
                parts: sw.name.split("."),
                dataType: sw.dataType,
            });
        }
        return props;
    }

    async logChange(container: string, id: string, change: Change) {
        const params = new QueryParams(this);
        params.add("container", container);
        params.add("id", id);
        params.add("change", JSON.stringify(change));
        params.add("timestamp", formatDatabaseDateTime(new Date()));

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
        const result = await this.exec(
            sql, 
            params.prepare(),
        );
    }

    async createSearchTable(searchTableName: string) {
        await this.exec(`CREATE TABLE ${this.encodeName(searchTableName)} (${this.encodeName("id")} ${this.options.dataTypes.small} NOT NULL PRIMARY KEY)`);
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

	getComparator(comparator: string) {
		if ((comparator === "==") || (comparator === "===")) {
			return "=";
		} else if (comparator === "!=") {
			return " <> ";
		} else if (comparator === "&&") {
			return " AND ";
		} else if (comparator === "||") {
			return " OR ";
		} else {
			return comparator;
		}
	}

	getLimitSql(maxRows: number, startingOffset?: number) {
		
	}

};