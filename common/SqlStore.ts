import { Change, Comparison, ContainerDef, DataType, Expression, ObjectDef, SchemaDef, SearchOptions, TrackingOptions, UserContext, diff, mapDataType, parseSearchQueryString } from "rant-store";
import { DBPropDef, NoDatabaseException, SqlDB } from "./SqlDB";
import { QueryParams } from "./QueryParams";
import { formatDateTime, isString, uuid } from "rant-utils";

export class SqlStore {

    db?: SqlDB;

    constructor() {
    }

    async connect() {
        console.log("SqlStore.connect()");
        // override with actual db connection
        // make sure once connected a call is made to db.checkForBaseRequirements()
    }

    async close() {
        console.log("SqlStore.close()");
        if (!this.db) throw new NoDatabaseException();

        return this.db.close();
    }

    async getContainer(options: {
        name: string,
    }) {
        console.log("SqlStore.getContainer()");
        if (!this.db) throw new NoDatabaseException();

        const name = options.name.toLowerCase();
        return this.db.getOne(`SELECT * from schema WHERE container = '${name}'`);
    }

    async deleteContainer(options: {
        name: string
    }) {
        console.log("SqlStore.deleteContainer()");
        if (!this.db) throw new NoDatabaseException();

        const name = options.name.toLowerCase();

        // console.log(`Attempting to delete ${name}`);
        if (await this.db.tableExists(name)) {
            // console.log(`Removing table '${name}'`)
            await this.db.exec(`DELETE FROM schema WHERE container = '${name}';`);
            await this.db.exec(`DELETE FROM changes WHERE container = '${name}';`);
            await this.db.exec(`DROP TABLE IF EXISTS ${this.db.encodeName(name)};`);
            // console.log(`Deleted ${name}`);
        } else {
            // console.log(`${name} not found`);
        }
    }


    async setContainer(options: 
        ContainerDef & {
            recreate?: boolean,
            delete?: boolean,
            user?: UserContext,
        },
        changeTracking: TrackingOptions,
    ) {
        console.log("SqlStore.setContainer()");
        if (!this.db) throw new NoDatabaseException();

        const name = options.name.toLowerCase();
        // console.log(`store.setContainer: ${name}`)

        try {

            if (options.delete) {
                await this.deleteContainer({ name });
                return;
            }

            if (options.recreate) {
                await this.deleteContainer({ name });
            }

            // console.log("Checking table exists: " + name);
            if (!(await this.db.tableExists(name))) {
                // console.log(`Creating container table '${options.name}'`)
                await this.db.createContainer({ name });
            }

            if (options.searchWithin) {
                await this.setSchema(
                    options, 
                    {
                        track: false, // don't track this change because tracked with the setContainer change
                    }, 
                );
            }

        } finally {
            if (changeTracking.track) {
                await this.db.logChange(name, "", {
                    type: "container-set",
                    value: options,
                });    
            }
        }

        return true;
    }    

    async setSchema(
        options: SchemaDef,
        changeTracking: TrackingOptions,
    ) {
        console.log("SqlStore.setSchema()");
        if (!this.db) throw new NoDatabaseException();

        const {
            name,
            searchWithin,
            sensitive,
        } = options;

        if (!searchWithin && !sensitive) return;

        const baseTableName = name;
        const searchTableName = this.db.getSearchTableName(name);

        const updates = [];

        const params = new QueryParams(this.db);
        const pName = params.add("name", name);

        if (searchWithin) {
            const p = params.add("indexes", JSON.stringify({ searchWithin, }));
            updates.push(`indexes=${this.db.formatParamName(p)}`);
        }
        if (sensitive) {
            const p = params.add("sensitive", JSON.stringify(sensitive));
            updates.push(`sensitive=${this.db.formatParamName(p)}`);
        }

        // console.log(`UPDATE schema SET ${updates.join(",")} WHERE container=$1`);
        // console.log(JSON.stringify(params))
        const sql = `UPDATE schema SET ${updates.join(",")} WHERE container=${params.name("name")}`;
        console.log(sql + ", with params: " + JSON.stringify(this.db.prepareParams(params)));
        const execResult = await this.db.exec(
            sql,
            this.db.prepareParams(params),
        );
        console.log("execResult: " + JSON.stringify(execResult));

        // update indexes 
        if (searchWithin) {
            // does table exist?
            let isNewTable = false;
            if (!await this.db.searchTableExists(name)) {
                await this.db.createSearchTable(searchTableName);
                isNewTable = true;
            }

            // get existing columns on the tbl
            const existing = await this.db.getTableColumns(searchTableName);

            const props = this.db.parseSearchWithin(searchWithin);

            const toPopulate = [];

            // what columns need to be added?
            const namesRequired = ["key"];
            for(let prop of props) {
                namesRequired.push(prop.name);

                // does col already exist?
                let ignore = false;
                if (existing) {
                    for(let row of existing) {
                        if (row.name === prop.name) {
                            ignore = true;
                            break;
                        }
                    }
                }
                if (ignore) {
                    continue;
                }

                const dt = (mapDataType(prop.dataType) == DataType.number) ? "INT" : "TEXT";
                console.log(`ALTER TABLE ${this.db.encodeName(searchTableName)} ADD ${this.db.encodeName(prop.name)} ${dt}`);
                await this.db.exec(`ALTER TABLE ${this.db.encodeName(searchTableName)} ADD ${this.db.encodeName(prop.name)} ${dt}`);
                toPopulate.push(prop);
            }

            // are there any indexes to delete?
            if (existing) {
                for(let row of existing) {
                    if (namesRequired.indexOf(row.name) < 0) {
                        await this.db.exec(`ALTER TABLE ${this.db.encodeName(searchTableName)} DROP ${this.db.encodeName(row.name)}`);
                    }
                }
            }

            if (toPopulate.length > 0) {
                const { rebuildIndex } = this.indexUpdater(options.name, toPopulate);

                const data = await this.db.getAll(`SELECT key, value FROM ${this.db.encodeName(baseTableName)}`);
                if (data) {
                    for(let row of data) {
                        const value = JSON.parse(row.value);
                        await rebuildIndex(row.key, value, isNewTable);
                    }
                }
            }
        }

        if (changeTracking.track) {
            await this.db.logChange(name, "", {
                type: "container-set-schema",
                value: options,
            });
        }

        return true;
    }

    private indexUpdater(container: string, props: DBPropDef[]) {
        console.log("SqlStore.indexUpdater()");
        if (!this.db) throw new NoDatabaseException();

        // populate new columns

        const params = new QueryParams(this.db);
        for(let def of props) {
            params.add(def.name);
        }
        params.add("key");

        let attribColumnNames = props.map((def, i) => {
            return def.name;
        }).join(",");
        console.log("attribColumnNames: " + JSON.stringify(attribColumnNames))

        let attribValueParams = props.map((def) => params.name(def.name)).join(",");
        console.log("attribValueParams: " + JSON.stringify(attribValueParams))

        let attribUpdatePairs = props.map((def, i) => def.name + "=" + params.name(def.name)).join(",");
        console.log("attribUpdatePairs: " + JSON.stringify(attribUpdatePairs))

        const searchTableName = this.db!.getSearchTableName(container);

        const doInsert = async (values: any, key: string) => {
            if (!this.db) throw new NoDatabaseException();

            params.setValues(values);

            const sql = `
                INSERT INTO ${this.db.encodeName(searchTableName)} 
                (key, ${attribColumnNames})
                VALUES (${params.name("key")}, ${attribValueParams})`;
            console.log(sql);
            console.log(JSON.stringify(params))
            console.log(JSON.stringify(attribColumnNames))
            await this.db.exec(
                sql,
                params.prepare(),
            );
        }
        const doUpdate = async (values: any, key: string) => {
            if (!this.db) throw new NoDatabaseException();

            params.setValues(values);

            const sql = `
                UPDATE ${this.db.encodeName(searchTableName)}
                SET ${attribUpdatePairs}
                WHERE key=${params.name("key")}`;
            console.log(sql);
            const result = await this.db.exec(
                sql,
                params.prepare(),
            );
            if (!result.rowCount) {
                await doInsert(values, key);
            }
        }

        // NOTE: value is object not json
        async function rebuildIndex(
            key: string, value: any, 
            // if know for sure its a new object then slightly faster to just insert instead try update and fallback to insert
            isNewObject?: boolean
        ) {
            console.log("SqlStore.indexUpdater.rebuildIndex()");
            // console.log("rebuildIndex: " + key + ": " + JSON.stringify(value));

            const values: any = {};

            console.log("props: " + JSON.stringify(props))

            for(let prop of props) {
                let v;

                if (!value) {
                    // no value
                } else if (prop.parts.length <= 1) {
                    // direct map to prop on value
                    v = value[prop.name];
                } else {
                    // have to navigate through object to get to value
                    let o = value;
                    let isValid = true;
                    for(let i=0;i<prop.parts.length;i++) {
                        const part = prop.parts[i];
                        o = o[part];
                        if (o === undefined) {
                            isValid = false;
                            break;
                        }
                    }
                    if (isValid) {
                        v = o;
                    }
                }

                values[prop.name] = v;
            }

            values.key = key;
            if (isNewObject) {
                await doInsert(values, key);
            } else {
                await doUpdate(values, key);
            }
        }

        return {
            rebuildIndex,
        }

    }

    async get(options: {
        container: string, 
        key: string,
    }) {
        console.log("SqlStore.get()");
        if (!this.db) throw new NoDatabaseException();

        const params = new QueryParams(this.db);
        params.add("key", options.key);

        const row = await this.db.getOne(`
            SELECT value FROM ${this.db.encodeName(options.container)} 
            WHERE key like ${params.name("key")}
        `, params.prepare());

        if (row) {
            return row.value;
        } else {
            return undefined;
        }
    }

    // get existing value
    async getExisting(container: string, key: string) {
        console.log("SqlStore.getExisting()");
        if (!this.db) throw new NoDatabaseException();

        const params = new QueryParams(this.db);
        params.add("key", key);

        const result = await this.db.getOne(`
            SELECT value, version
            FROM ${this.db.encodeName(container)}
            WHERE key=${params.name("key")}`,
            params.prepare()
        );
        // console.log("existing: " + JSON.stringify(result));
        return result;
    }

    async set(
        options: {
            container: string, 
            object: ObjectDef,
            user?: UserContext,
        },

        // indicates that diffs should be determined and saved
        changeTracking: TrackingOptions,
    ) {
        console.log("SqlStore.set()");
        if (!this.db) throw new NoDatabaseException();

        const container = options.container;

        // get the key
        let key = options.object.key;

        if (!key) {
            // if inserting, auto create a key
            key = uuid();
        }

        // and remove from the supplied object because don't want key saved into value
        delete options.object["key"];

        const update = async (existing: any, retryCount: number) => {
            if (!this.db) throw new NoDatabaseException();

            if (!existing.version) existing.version = 1;
            const newVersion = existing.version + 1;
            
            const valueAsString = JSON.stringify(options.object);

            const params = new QueryParams(this.db);
            params.add("key", key);
            params.add("value", valueAsString);
            params.add("existingVersion", existing.version);
            params.add("newVersion", newVersion);

            const sql = `
                UPDATE ${this.db.encodeName(container)} SET 
                    value=${params.name("value")},
                    version=${params.name("newVersion")}
                WHERE 
                    key=${params.name("key")}
                    and version=${params.name("existingVersion")}
            `;
            const result = await this.db.exec(sql, this.db.prepareParams(params));
            //console.log(result);
            if (!result.rowCount) {
                // failed to update, is it because another update happened?
                const maxRetries = 3;
                if (++retryCount < maxRetries) {
                    const existing = await this.getExisting(container, key!);
                    await update(existing, retryCount);
                } else {
                    throw `Unable to update ${container}/${key} after ${maxRetries} retries`;
                }
            }

            // check what has changed
            const objExisting = JSON.parse(existing.value);
            const changes = diff(objExisting, options.object);
            if (changes.length > 0) {
                if (changeTracking.track) {
                    await this.db.logChange(
                        container,
                        key!,
                        {
                            type: "object-update",
                            container,
                            key,
                            changes,
                        }
                    );
                }
            }
        }

        const insert = async () => {
            console.log("SqlStore.set.insert()");
            if (!this.db) throw new NoDatabaseException();

            const valueAsString = JSON.stringify(options.object);

            const params = new QueryParams(this.db);
            params.add("key", key);
            params.add("value", valueAsString);
            params.add("version", existing ? existing.version : 1);

            const sql = `
                INSERT INTO ${this.db.encodeName(container)}
                    (key, value, version) 
                VALUES (
                    ${params.name("key")}, 
                    ${params.name("value")}, 
                    ${params.name("version")}
                )`;

            console.log(sql);
            console.log(JSON.stringify(params));

            const result = await this.db.exec(sql, params.prepare());
            if (!result.rowCount) {
                throw "Failed attempt to insert ${container}/${key}";
            }

            options.object.key = key;
            if (changeTracking.track) {
                await this.db.logChange(container, key!, {
                    type: "object-add",
                    container: container,
                    value: options.object,
                });
            }
        }

        const existing = await this.getExisting(container, key);
        if (existing) {
            options.object.updated = formatDateTime(new Date());
            if (options.user) options.object.updated_by = options.user.key;
            await update(existing, 0);
        } else {
            options.object.created = formatDateTime(new Date());
            if (options.user) options.object.created_by = options.user.key;
            await insert();
        }


        // update indexes
        const indexes = await this.getIndexes(container);
        if (indexes) {
            console.log("indexes.searchWithin: "+ JSON.stringify(indexes.searchWithin))
            const props = this.db.parseSearchWithin(indexes.searchWithin);

            const { rebuildIndex } = this.indexUpdater(container, props);
            await rebuildIndex(key, options.object);
        }

        // put the key back back onto the object
        options.object.key = key;

        //return result;
    }

    async del(
        options: {
            container: string,
            key: string,
        },
        changeTracking: TrackingOptions,
    ) {
        console.log("SqlStore.del()");
        if (!this.db) throw new NoDatabaseException();

        const { container, key } = options;

        const existing = await this.getExisting(container, key);
        if (existing) {

            const params = new QueryParams(this.db);
            params.add("key", key);
            
            await this.db.exec(`
                DELETE FROM ${this.db.encodeName(container)}
                WHERE key=${params.name("key")}`, 
                params.prepare(),
            );

            if (changeTracking.track) {
                await this.db.logChange(container, key, {
                    type: "object-delete",
                    container,
                    key,
                });
            }
        } else {
            throw `Item ${container}/${key} not found`;
        }

        return true;
    }

    async getIndexes(container: string) {
        console.log("SqlStore.getIndexes()");
        if (!this.db) throw new NoDatabaseException();

        const params = new QueryParams(this.db);
        params.add("container", container);

        const result = await this.db.getOne(`
            SELECT indexes
            FROM schema 
            WHERE container = ${params.name("container")}`, 
            params.prepare()
        );

        return result ? JSON.parse(result.indexes) : undefined;
    }

    async getSchema(options: {
        name: string,
    }) {
        console.log("SqlStore.getSchema()");
        if (!this.db) throw new NoDatabaseException();

        const params = new QueryParams(this.db);
        params.add("container", options.name);

        const item = await this.db.getOne(`SELECT * FROM schema WHERE container = ${params.name("container")}`, params.prepare());
        if (!item) return undefined;

        return {
            name: options.name,
            indexes: JSON.parse(item.indexes),
            sensitive: JSON.parse(item.sensitive),
        }
    }

    async reset(options: {

    }) {
        console.log("SqlStore.reset()");
        if (!this.db) throw new NoDatabaseException();

        // get all existing tables
        console.log("a")
        const names = await this.db.getUserTables();
        console.log("reset: names: " + JSON.stringify(names));
        if (!names) return;

        const ignore: string[] = [
        ];

        for(let row of names) {
            if (ignore.indexOf(row.name) < 0) {
                const sql = `DROP TABLE ${this.db.encodeName(row.name)}`;
                console.log(sql);
                await this.db.exec(sql);
            }
        }

        return this.db.checkForBaseRequirements();
    }


    async searchAll(queries: SearchOptions[]) {
        console.log("SqlStore.searchAll()");
        const results = [];

        for(let q of queries) {
            results.push(this.search(q));
        }

        return Promise.all(results);
    }

    async search(options: SearchOptions) {
        console.log("SqlStore.search()");
        if (!this.db) throw new NoDatabaseException();

        const crit: string[] = [];
        //const vals = {} as any;
        const params: any[] = [];
        let paramCounter = 1;

        const returnType = options.returnType ? options.returnType : "keys";

        let qry = options.qry;

        // get the props that have been indexed 
        // ... as we parse the query need to confirm that only those are being referenced
        const indexes = await this.getIndexes(options.container);
        const availableIndexes = {} as any;
        if (indexes && indexes.searchWithin) {
            for(let i=0;i<indexes.searchWithin.length;i++) {
                const sw = indexes.searchWithin[i];
                availableIndexes[sw.name] = true;
            }
        }
        // console.log("availableIndexes: " + JSON.stringify(availableIndexes));

        function hasIndex(name: string) {
            return (availableIndexes[name] !== undefined);
        }
        
        function parseComparison(ex: Comparison) {
            if (!hasIndex(ex.prop)) {
                throw `Attempting to query a property '${ex.prop}' in container '${options.container}' that has not been indexed`;
            }

            const paramName = "$" + paramCounter++;
            crit.push(
                "s." + ex.prop.replace(".", "_") + " " + ex.comparator + " " + paramName
            );
            params.push(ex.value);
        }
        function parseComparisonArray(items: Expression[]) {
            if (items.length <= 0) return;

            for(let i=0;i<items.length;i++) {
                const comparison = items[i] as Comparison;

                if (Array.isArray(comparison)) {
                    if (comparison.length > 0) {
                        if (i > 0) {
                            const first = comparison[0];
                            crit.push(" " + ((first.op == "||") ? "OR" : "AND") + " ");
                        }
                        crit.push("(");
                        parseComparisonArray(comparison);    
                        crit.push(")");
                    }
                } else {
                    if (i > 0) {
                        crit.push(" " + ((comparison.op == "||") ? "OR" : "AND") + " ");
                    }
                    parseComparison(comparison);    
                }

            }
        }

        if (qry) {
            // were we provide an already built query or just a string?
            if (isString(qry)) {
                // first build query object 
                const parsed = parseSearchQueryString(qry as any, options.params);
                if (parsed.errors && parsed.errors.length > 0) {
                    return parsed.errors;
                }
                qry = parsed.query;
            }

            console.log("qry obj: " + JSON.stringify(qry))

            if (Array.isArray(qry)) {
                parseComparisonArray(qry);
            } else {
                parseComparison(qry as any);
            }            
        }

        let sql = `
            SELECT t.key${((returnType !== "keys") ? ", t.value" : "")}
            FROM ${this.db.encodeName(options.container)} t
            INNER JOIN ${this.db.encodeName(this.db.getSearchTableName(options.container))} s ON t.key = s.key
        `;
        if (crit.length > 0) {
            sql += `WHERE ${crit.join("")}`;
        }
        console.log(sql);

        const items = await this.db.getAll(sql, params);
        if (returnType === "map") {
            // map
            const map: any = {};
            if (items) {
                for(let i of items) {
                    map[i.key] = i;
                    delete i.key;
                }
            }
            return map;

        } else if (returnType === "array") {
            // array
            return items;

        } else {
            // keys
            const result: string[] = [];
            if (items) {
                for(let i of items) {
                    result.push(i.key);
                }    
            }
            return result;
        }
    }

    async getChanges(options: {
        since?: Date,
        from?: number, // id
    }) {
        console.log("SqlStore.getChanges()");
        if (!this.db) throw new NoDatabaseException();

        //let sql = "SELECT id, container, key, change, timestamp FROM changes";
        let sql = "SELECT change FROM changes";

        let paramCounter = 1;

        const params = [] as any[];
        const where = [];
        if (options.since) {
            where.push(`timestamp >= $${paramCounter++}`);
            params.push(options.since);
        }
        if (options.from) {
            where.push(`id >= $${paramCounter++}`);
            params.push(options.from);
        }
        if (where.length > 0) {
            sql += " WHERE (" + where.join(" AND ") + ")";
        }

        sql += " ORDER BY id";

        const items = await this.db.getAll(sql, params);
        const result = [];
        if (items) {
            for(let item of items) {
                result.push(JSON.parse(item.change));
            }    
        }
        return result;
    }

    async merge(options: {
        changes: Change[],
    }) {
        console.log("SqlStore.merge()");

        for(let change of options.changes) {
            if (change.type === "object-add") {
                const container = change.container;
                const object = change.value;
                if (container) {
                    await this.set(
                        {
                            container, 
                            object,
                        }, 
                        {
                            track: false, // don't track this change
                        }, 
                    );
                }
            
            } else if (change.type === 'object-update') {
                if (change.container && change.key && change.changes) {
                    await this.applyChangesToObject(
                        change.container,
                        change.key,
                        change.changes
                    );
                }

            } else if (change.type === "object-delete") {
                const container = change.container;
                const key = change.key;
                if (container && key) {
                    await this.set(
                        {
                            container,
                            object: {
                                key,
                            },
                        },
                        {
                            track: false, // don't track this change
                        }, 
                    );

                }

            } else if (change.type === 'container-set') {
                await this.setContainer(change.value, { track: false });

            } else if (change.type === "container-set-schema") {
                await this.setSchema(change.value, { track: false });

            }

        }

    }

    async applyChangesToObject(container: string, key: string, changes: Change[]) {
        console.log("SqlStore.applyChangesToObject()");

        //console.log(`Applying changes to ${container}/${key}`);

        // get existing value 
        const json = await this.get({ container, key });
        if (!json) {
            // object no longer exists
            // TODO: how report this error?
            return;
        }

        const object = JSON.parse(json);
        if (!object) {
            // TODO: how report this error?
            return;
        }

        function getProp(path: string, returnParent?: boolean) {
            const parts = path.split(".");
            let o = object;

            if (returnParent && parts.length === 1) return o;

            for(let i=0;i<parts.length;i++) {
                if (o === undefined) return undefined;
                const p = parts[i];
                o = o[p];

                if (returnParent && (i === parts.length-2)) return o;
            }
            return o;
        }
        function setProp(path: string, val: any) {
            const parts = path.split(".");
            let o = object;
            for(let i=0;i<parts.length-1;i++) {
                const p = parts[i];

                let oNext = o[p];
                if (oNext === undefined) {
                    // if can't find part of the path then have to create as we go
                    oNext = {};
                }
                o = oNext;
            }

            o[parts[parts.length-1]] = val;
        }

        for (let c of changes) {
            //console.log("change: " + JSON.stringify(c));

            if (c.type === 'array-add') {
                const a = getProp(c.prop!);
                if (a) {
                    a.splice(c.index, 0, c.value);
                } else {
                    // TODO: error?
                }

            } else if (c.type === "array-update") {
                const a = getProp(c.prop!);
                if (a) {
                    for(let i=0;i<a.length;i++) {
                        const elem = a[i];
                        if (elem.key === c.key) {
                            a[i] = c.value;
                            break;
                        }
                    }
                } else {
                    // TODO: error?
                }

            } else if (c.type === 'array-delete') {
                const a = getProp(c.prop!);
                if (a) {
                    for(let i=0;i<a.length;i++) {
                        const elem = a[i];
                        if (elem.key === c.key) {
                            a.splice(i, 1);
                            break;
                        }
                    }
                } else {
                    // TODO: error?
                }

            } else if (c.type === 'array-order') {
                const indexed = [];
                const items = getProp(c.prop!);
                if (items && c.value && c.value.length > 0) {
                    const map = {} as any;
                    for(let item of items) {
                        map[item.key] = item;
                    }
                    const sorted = [];
                    for(let key of c.value) {
                        sorted.push(map[key]);
                    }

                } else {
                    // TODO: error?

                }

            } else if (c.type === 'prop-add') {
                if (c.prop) {
                    setProp(c.prop, c.value);
                    
                } else {
                    // TODO: error?

                }

            } else if (c.type === 'prop-delete') {
                if (c.prop) {
                    const parent = getProp(c.prop, true);
                    if (parent) {
                        delete parent[c.prop];
                    }
                } else {
                    // TODO: error?

                }

            } else if (c.type === 'prop-rename') {
                if (c.prop && c.value) {
                    const parent = getProp(c.prop, true);
                    if (parent) {
                        const val = parent[c.prop];
                        const newPropName = c.value;
                        parent[newPropName] = val;
                        delete parent[c.prop];
                    }
                } else {
                    // TODO: error?

                }

            } else if (c.type === 'prop-update') {
                if (c.prop) {
                    setProp(c.prop, c.value);
                    
                } else {
                    // TODO: error?

                }

            }

        }

        // make sure the key is part of the object
        object.key = key;

        // now that all change are applied attempt to update the object with new value
        await this.set(
            {
                container, 
                object,
            },
            {
                track: false, // don't track this change
            }, 
        );
    }



}
