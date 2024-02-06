import { MSSQLDB } from "./MSSQLDB";
import { SqlStore } from "../common/SqlStore";
import { toInt } from "rant-utils";

export class MSSQLStore extends SqlStore {

    constructor() {
        super();
    }

    async connect() {
        const env = process.env;

        const db = new MSSQLDB({
            server: env.DB_HOST,
            authentication: {
                type: "default",
                options: {
                    userName: env.DB_USER,
                    password: env.DB_PASSWORD,        
                },
            },
            options: {
                database: env.DB_DATABASE,
                port: toInt(env.DB_PORT),
            }    
        });
        await db.connect();
        this.db = db;   
        
        await db.checkForBaseRequirements();
    }
    

    

}