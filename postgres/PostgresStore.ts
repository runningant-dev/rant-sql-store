import { PostgresDB } from "./PostgresDB";
import { SqlStore } from "../common/SqlStore";
import { toInt } from "rant-utils";
import { NoDatabaseException } from "../common/SqlDB";
import { info } from "../log";

export class PostgresStore extends SqlStore {

	usePool: boolean = true;

    constructor(options?: { usePool?: boolean }) {
        super();

		if (options) {
			if (options.usePool === false) this.usePool = false;
		}
    }

    async connect() {
        const env = process.env;

        const db = new PostgresDB({
            host: env.DB_HOST,
            port: toInt(env.DB_PORT),
            user: env.DB_USER,
            password: env.DB_PASSWORD,
            database: env.DB_DATABASE,
            ssl: (env.DB_SSL === "true" ? true : false),

			usePool: this.usePool,
        });
        await db.connect();
        this.db = db;   
        
        await db.checkForBaseRequirements();
    }
    
	async createIndex(searchTableName: string, propName: string) {
		if (!this.db) throw new NoDatabaseException();

		const sql = `
			CREATE INDEX 
			${this.db.encodeName("idx_" + searchTableName + "_" + propName)} 
			ON ${this.db.encodeName(searchTableName)}
			USING btree (
				${this.db.encodeName(propName)}
			);
		`;

		info(sql);

		await this.db.exec(
			sql
		);
	}

    

}