import { PostgresDB } from "./PostgresDB";
import { SqlStore } from "../common/SqlStore";

export class PostgresStore extends SqlStore {

    constructor() {
        super();
    }

    async connect() {
        const db = new PostgresDB({
            host: "localhost",
            port: 5432,
            user: "postgres",
            password: "postgres",
            database: "store",
            ssl: false,
        });
        await db.connect();
        this.db = db;   
        
        await db.checkForBaseRequirements();
    }
    

    

}