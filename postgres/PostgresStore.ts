import { PostgresDB } from "./PostgresDB";
import { SqlStore } from "../common/SqlStore";
import { toInt } from "rant-utils";

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
            ssl: (env.DB_SSL ? true : false),
        });
        await db.connect();
        this.db = db;   
        
        await db.checkForBaseRequirements();
    }
    

    

}