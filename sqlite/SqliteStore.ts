// import { SqlStore } from "../common/SqlStore";
// import { SqliteDB } from "./SqliteDB";

// export class SqliteStore extends SqlStore {

//     filename: string;

//     constructor(filename: string) {
//         super();
//         this.filename = filename;
//     }

//     async connect() {
//         const db = new SqliteDB({
//             filename: this.filename,
//         });
//         await db.connect();
//         this.db = db;   
        
//         await db.checkForBaseRequirements();
//     }

// }