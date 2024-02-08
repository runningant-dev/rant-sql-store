import { MSSQLDB } from "./MSSQLDB";
import { SqlStore } from "../common/SqlStore";
import { toInt } from "rant-utils";

export class MSSQLStore extends SqlStore {

    constructor() {
        super();
    }

    async connect() {
        const env = process.env;

        const db = new MSSQLDB(
            {
                server: env.DB_HOST as string,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_DATABASE,
                pool: {
                    max: 20,
                    min: 0,
                    idleTimeoutMillis: 5 * 60 * 1000,
                },
                options: {
                    encrypt: true, // for azure
                    trustServerCertificate: false // change to true for local dev / self-signed certs
                }
            }
        );
        await db.connect();
        this.db = db;   
        
        await db.checkForBaseRequirements();
    } 

}