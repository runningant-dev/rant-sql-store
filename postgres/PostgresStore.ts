import { PostgresDB } from "./PostgresDB";
import { SqlStore } from "../common/SqlStore";
import { toInt } from "rant-utils";
import { NoDatabaseException } from "../common/SqlDB";

export class PostgresStore extends SqlStore {

    constructor() {
        super();
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
				LOWER(${this.db.encodeName(propName)})
			);
		`;

		console.log(sql);

		await this.db.exec(
			sql
		);
	}

    

}