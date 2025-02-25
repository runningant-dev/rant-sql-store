import { 
    AuthToken,
    Change, Comparison, ContainerDef, DataType, Expression, ObjectDef, SearchOptions, TrackingOptions, 
    diff, mapDataType, parseSearchQueryString, pruneSensitiveData
} from "rant-store";
import { DBPropDef, NoDatabaseException, SqlDB } from "./SqlDB";
import { QueryParams } from "./QueryParams";
import { formatDatabaseDateTime, isString } from "rant-utils";
import { v1 as uuidv1, v4 as uuidv4 } from "uuid";
import { data, error, info } from "../log";


export type EventType =
	"connect" |
	"close" |
	"getcontainer" |
	"delcontainer" |
	"setcontainer" |
	"get" |
	"set" |
	"del" |
	"search" |
	"createindex"
;

export interface Event {
	type: EventType,
	[k: string]: any,
};

export class SqlStore {

    db?: SqlDB;

	listeners: any[] = [];

    constructor() {
    }

    async connect() {
        info("SqlStore.connect()");
        // override with actual db connection
        // make sure once connected a call is made to db.checkForBaseRequirements()

		await this.notify({
			type: "connect",
		});
    }

    async close() {
        info("SqlStore.close()");
        if (!this.db) throw new NoDatabaseException();

        const result = await this.db.close();

		await this.notify({
			type: "close",
		});

		return result;
    }

    async getContainer(options: {
        name: string,
    }) {
        //info("SqlStore.getContainer()");
        if (!this.db) throw new NoDatabaseException();

        const name = options.name.toLowerCase();
        const row = await this.db.getOne(`SELECT * from ${this.db.encodeName("schema")} WHERE ${this.db.encodeName("container")} = '${name}'`);

        const result = {
            name,
            indexes: row ? JSON.parse(row.indexes) : undefined,
            sensitive: row ? JSON.parse(row.sensitive) : undefined,
        };

		await this.notify({
			type: "getcontainer",
			container: result,
		});

		return result;
    }

    async deleteContainer(options: {
        name: string
    }) {
        info("SqlStore.deleteContainer()");
        if (!this.db) throw new NoDatabaseException();

        const name = options.name.toLowerCase();

		const e: Event = {
			type: "delcontainer",
		};

        // info(`Attempting to delete ${name}`);
        if (await this.db.tableExists(name)) {
            // info(`Removing table '${name}'`)
            await this.db.exec(`DELETE FROM ${this.db.encodeName("schema")} WHERE ${this.db.encodeName("container")} = '${name}';`);
            await this.db.exec(`DELETE FROM changes WHERE ${this.db.encodeName("container")} = '${name}';`);
            await this.db.exec(`DROP TABLE IF EXISTS ${this.db.encodeName(name)};`);
			e.existed = true;

            // info(`Deleted ${name}`);
        } else {
            // info(`${name} not found`);
        }

		await this.notify(e);
    }

    async setContainer(options: 
        ContainerDef & {
            recreate?: boolean,
            delete?: boolean,
            authToken?: AuthToken,
        },
        changeTracking?: TrackingOptions,
    ) {
        info("SqlStore.setContainer()");
        if (!this.db) throw new NoDatabaseException();

        const name = options.name.toLowerCase();
        const {
            indexes,
            sensitive,
        } = options;

		const e: Event = {
			type: "setcontainer",
		};

        try {

            if (options.delete) {
				e.deleted = true;
                await this.deleteContainer({ name });
                return;
            }

            if (options.recreate) {
				e.deleted = true;
                await this.deleteContainer({ name });
            }

            // info("Checking table exists: " + name);
            if (!(await this.db.tableExists(name))) {
                // info(`Creating container table '${options.name}'`)
                await this.db.createContainer({ name });
            }

			// there is a possibility that the table exists but its not yet in the schema table
			// so detect and auto correct for that
			const checkSchema = async(db: SqlDB) => {
                const params = new QueryParams(db);
                const pName = params.add("container", name);

				const p = params.prepare();

				if (!(await db.getOne(`SELECT container FROM ${db.encodeName("schema")} WHERE container=${db.formatParamName(pName)}`, p))) {
					await db.exec(`INSERT INTO ${db.encodeName("schema")} (container) VALUES (${db.formatParamName(pName)});`, p);
				}
			}
			await checkSchema(this.db!);


            if ((indexes && indexes.length > 0) || (sensitive && sensitive.length > 0)) {

                const baseTableName = name;
                const searchTableName = this.db.getSearchTableName(name);

                const updates = [];

                const params = new QueryParams(this.db);
                const pName = params.add("name", name);

                if (indexes && indexes.length > 0) {
                    const p = params.add("indexes", JSON.stringify(indexes));
                    updates.push(`indexes=${this.db.formatParamName(p)}`);
                }
                if (sensitive && sensitive.length > 0) {
                    const p = params.add("sensitive", JSON.stringify(sensitive));
                    updates.push(`sensitive=${this.db.formatParamName(p)}`);
                }

                // info(`UPDATE schema SET ${updates.join(",")} WHERE container=$1`);
                // info(JSON.stringify(params))
                const sql = `UPDATE ${this.db.encodeName("schema")} SET ${updates.join(",")} WHERE ${this.db.encodeName("container")}=${params.name("name")}`;
				const preparedParams = this.db.prepareParams(params);

				data(sql);
				data(preparedParams);
				
                const execResult = await this.db.exec(
                    sql,
                    preparedParams,
                );
                //info("execResult: " + JSON.stringify(execResult));
				data(execResult);

                // update indexes 
                if (indexes && indexes.length > 0) {
                    // does table exist?
                    let isNewTable = false;
                    if (!await this.db.searchTableExists(name)) {
                        await this.db.createSearchTable(searchTableName);
                        isNewTable = true;
                    }

                    // get existing columns on the tbl
                    const existing = await this.db.getTableColumns(searchTableName);

                    const props = this.db.parseIndexes(indexes);

                    const toPopulate = [];

                    // what columns need to be added?
                    const namesRequired = ["id"];
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

                        // NOTE: for quick search, indexed strings, need limit
                        const dt = (mapDataType(prop.dataType) == DataType.number) ? 
                                    this.db.options.dataTypes.int 
                                    : this.db.options.dataTypes.maxSearchable;

						const sql = 
							`ALTER TABLE ${this.db.encodeName(searchTableName)}
							ADD COLUMN ${this.db.encodeName(prop.name)} ${dt};
							`;
                        data(sql);
                        await this.db.exec(
							sql
						);

						// create index for searching on this column
						await this.createIndex(searchTableName, prop.name);

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

                        const data = await this.db.getAll(`SELECT ${this.db.encodeName("id")}, ${this.db.encodeName("value")} FROM ${this.db.encodeName(baseTableName)}`);
                        if (data) {
                            for(let row of data) {
                                const value = JSON.parse(row.value);
                                await rebuildIndex(row.id, value, isNewTable);
                            }
                        }
                    }
                }
            }       

            // add any initial objects if supplied
            if (options.objects && options.objects.length > 0) {    
                for(let o of options.objects) {
                    await this.set({
                        container: name,
                        object: o,
                    }, 
                    // NOTE: tracking not required because it will get auto performed with the set-container change which is tracked
                    { track: false }
                    );
                }
            }                

        } finally {
            if (!changeTracking || changeTracking.track) {
                await this.db.logChange(name, "", {
                    type: "container-set",
                    value: options,
                });    
            }
        }

		await this.notify(e);

        return true;
    }    

    private indexUpdater(container: string, props: DBPropDef[]) {
        info("SqlStore.indexUpdater()");
        if (!this.db) throw new NoDatabaseException();

        // populate new columns

        const params = new QueryParams(this.db);
        for(let def of props) {
            params.add(def.name);
        }
        params.add("id");

        let attribColumnNames = props.map((def, i) => {
            return this.db?.encodeName(def.name);
        }).join(",");
        info("attribColumnNames: " + JSON.stringify(attribColumnNames));

        let attribValueParams = props.map((def) => params.name(def.name)).join(",");
        info("attribValueParams: " + JSON.stringify(attribValueParams));

        let attribUpdatePairs = props.map((def, i) => this.db?.encodeName(def.name) + "=" + params.name(def.name)).join(",");
        info("attribUpdatePairs: " + JSON.stringify(attribUpdatePairs));

        const searchTableName = this.db!.getSearchTableName(container);

        const doInsert = async (values: any, id: string) => {
            if (!this.db) throw new NoDatabaseException();

            params.setValuesLowercase(values);

            const sql = `
                INSERT INTO ${this.db.encodeName(searchTableName)} 
                (${this.db.encodeName("id")}, ${attribColumnNames})
                VALUES (${params.name("id")}, ${attribValueParams})`;

			const preparedParams = params.prepare();

			data(sql);
			data(preparedParams);
			data(attribColumnNames);

            await this.db.exec(
                sql,
                preparedParams,
            );
        }
        const doUpdate = async (values: any, id: string) => {
            if (!this.db) throw new NoDatabaseException();

            params.setValuesLowercase(values);

            const sql = `
                UPDATE ${this.db.encodeName(searchTableName)}
                SET ${attribUpdatePairs}
                WHERE ${this.db.encodeName("id")}=${params.name("id")}`;
            
			data(sql);

            const result = await this.db.exec(
                sql,
                params.prepare(),
            );
            if (!result.rowCount) {
                await doInsert(values, id);
            }
        }

        // NOTE: value is object not json
        async function rebuildIndex(
            id: string, value: any, 
            // if know for sure its a new object then slightly faster to just insert instead try update and fallback to insert
            isNewObject?: boolean
        ) {
            info("SqlStore.indexUpdater.rebuildIndex()");
            // info("rebuildIndex: " + id + ": " + JSON.stringify(value));

            const values: any = {};

			data(props);

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

				// use an empty string instead of null
				// this makes it less painful when searching
				if (v === undefined || v === null) v = "";

                values[prop.name] = v;
            }

            values.id = id;
            if (isNewObject) {
                await doInsert(values, id);
            } else {
                await doUpdate(values, id);
            }
        }

        return {
            rebuildIndex,
        }

    }

	validateIDs(ids?: string[]) {
		if (!ids) return undefined;
	
		const items = [];
	
		for(let id of ids) {
			if (!id || !id.length) continue;
			if (id.length > 50) continue;
			if (id.indexOf("'") >= 0) continue;
	
			items.push(id);
		}
	
		if (items.length <= 0) return undefined;
		return "'" + items.join("','").toLowerCase() + "'";
	}

    async get(options: {
        container: string, 
        ids: string[],

		pruneSensitive?: boolean,
        roles?: string[],

    }) {
        info("SqlStore.get()");
        if (!this.db) throw new NoDatabaseException();

		let pruner: any;

		function hasRole(name: string) {
			if (!options.roles) return false;
            return (options.roles.indexOf(name) >= 0);
        }
        
		if (options.pruneSensitive) {
			const container = await this.getContainer({ name: options.container });
			pruner = await pruneSensitiveData(this, container, hasRole);
		}

		function prepareRow(row: any) {
			const o = JSON.parse(row.value);
			if (o) {
				o.version = row.version;
				o.id = row.id;
			}

			if (pruner && pruner.isPruneRequired) {
				pruner.prune(o);
			}

			return o;
		}
	
		let result;

		if (options.ids.length === 1) {
			const id = options.ids[0];

			const params = new QueryParams(this.db);
			params.add("id", id);

			const row = await this.db.getOne(`
				SELECT ${this.db.encodeName("id")}, ${this.db.encodeName("value")}, ${this.db.encodeName("version")}
				FROM ${this.db.encodeName(options.container)} 
				WHERE id = ${params.name("id")}
			`, params.prepare());

			if (row) {
				result = prepareRow(row);
			} else {
				result = undefined;
			}

		} else {
			// multiple
			const preparedIDs = this.validateIDs(options.ids);
			const rows = await this.db.getAll(`
				SELECT ${this.db.encodeName("id")}, ${this.db.encodeName("value")}, ${this.db.encodeName("version")}
				FROM ${this.db.encodeName(options.container)} 
				WHERE id in (${preparedIDs})
			`);
			if (rows) {
				result = [];

				if (rows.length > 0) {
					for(let r of rows) {
						result.push(prepareRow(r));
					}	
				}

			} else {
				result = undefined;	
			}
		
		}

		await this.notify({
			type: "get",
			result,
		});

		return result;
    }

    async set(
        options: {
            container: string, 
            object: ObjectDef,
            authToken?: AuthToken,
            merge?: boolean,
            returnObject?: boolean,
        },

        // indicates that diffs should be determined and saved
        changeTracking?: TrackingOptions,
    ) {
        info("SqlStore.set()");
        if (!this.db) throw new NoDatabaseException();

        const container = options.container;

        // get the id
        let id = options.object.id;

        let prevValue;

		let e: Event = {
			type: "set",
			options,
		};

        if (!id) {
            // if inserting, auto create a id
            id = uuidv1(); // chronological ids
			e.autoAssignedID = id;
        
        } else if (options.merge) {
            // get existing data 
            prevValue = await this.get({ container: options.container, ids: [id], });
            if (!prevValue) prevValue = {};

            // merge in what has been supplied
			// NOTE: only merge at root level - any incoming data replaces existing prop at root level
			if (options.object) {
				for(var m in options.object) {
					prevValue[m] = options.object[m];
				}	
			}
            options.object = prevValue;
        }

        // and remove from the supplied object because don't want id saved into value
        delete options.object["id"];

		let newVersion = 1;

        const update = async (existing: any, retryCount: number) => {
            if (!this.db) throw new NoDatabaseException();

            if (!existing.version) existing.version = 1;
            newVersion = existing.version + 1;
            
            const valueAsString = JSON.stringify(options.object);

            const params = new QueryParams(this.db);
            params.add("id", id);
            params.add("value", valueAsString);
            params.add("existingVersion", existing.version);
            params.add("newVersion", newVersion);

            const sql = `
                UPDATE ${this.db.encodeName(container)} SET 
                    value=${params.name("value")},
                    version=${params.name("newVersion")}
                WHERE 
                    id=${params.name("id")}
                    and version=${params.name("existingVersion")}
            `;
            const result = await this.db.exec(sql, params.prepare());
            //info(result);
            if (!result.rowCount) {
                // failed to update, is it because another update happened?
                const maxRetries = 3;
                if (++retryCount < maxRetries) {
                    const existing = await this.get({ container, ids: [id], });
                    
                    // remove any injected props that will mess with the diff
                    if (existing && existing.version) delete existing.version;
                    
                    await update(existing, retryCount);
                } else {
                    throw `Unable to update ${container}/${id} after ${maxRetries} retries`;
                }
            }

            // check what has changed
            const changes = diff(existing, options.object);
            if (changes.length > 0) {
                if (!changeTracking || changeTracking.track) {
                    await this.db.logChange(
                        container,
                        id!,
                        {
                            type: "object-update",
                            container,
                            id,
                            changes,
                        }
                    );
                }
            }

        }

        const insert = async () => {
            info("SqlStore.set.insert()");
            if (!this.db) throw new NoDatabaseException();

            const valueAsString = JSON.stringify(options.object);

            const params = new QueryParams(this.db);
            params.add("id", id);
            params.add("value", valueAsString);
            params.add("version", newVersion);

            const sql = `
                INSERT INTO ${this.db.encodeName(container)}
                    (${this.db.encodeName("id")}, ${this.db.encodeName("value")}, ${this.db.encodeName("version")}) 
                VALUES (
                    ${params.name("id")}, 
                    ${params.name("value")}, 
                    ${params.name("version")}
                )`;

            data(sql);
            data(params.prepare());

            const result = await this.db.exec(sql, params.prepare());
            if (!result.rowCount) {
                throw "Failed attempt to insert ${container}/${id}";
            }

            options.object.id = id;
            if (!changeTracking || changeTracking.track) {
                await this.db.logChange(container, id!, {
                    type: "object-add",
                    container: container,
                    value: options.object,
                });
            }
        }

        const existing = await this.get({ container, ids: [id] });
        if (existing) {
            options.object.updated = formatDatabaseDateTime(new Date());
            if (options.authToken) options.object.updated_by = options.authToken.id;
            await update(existing, 0);
			e.updated = true;
        } else {
            options.object.created = formatDatabaseDateTime(new Date());
			options.object.updated = options.object.created;
            if (options.authToken) options.object.created_by = options.authToken.id;
            await insert();
			e.inserted = true;
        }


        // update indexes
        const indexes = await this.getIndexes(container);
        if (indexes && indexes.length > 0) {
            info("indexes: "+ JSON.stringify(indexes));
            const props = this.db.parseIndexes(indexes);

            const { rebuildIndex } = this.indexUpdater(container, props);
            await rebuildIndex(id, options.object);
        }

        // put the id back back onto the object
        options.object.id = id;
		// also update the version to match current db version
		options.object.version = newVersion;

        //return result;

		await this.notify({
			type: "set",
			result: options.object,
		});

        if (options.returnObject) {
            return options.object;
        }
    }

    async del(
        options: {
            container: string,
            id: string,
        },
        changeTracking?: TrackingOptions,
    ) {
        info("SqlStore.del()");
        if (!this.db) throw new NoDatabaseException();

        const { container, id } = options;

        const existing = await this.get({ container, ids: [id] });
        if (existing) {

            const params = new QueryParams(this.db);
            params.add("id", id);

            const c = await this.getContainer({ name: container, });
            if (!c) {
                throw `Unknown container ${container}`;
            }

            await this.db.exec(`
                DELETE FROM ${this.db.encodeName(container)}
                WHERE ${this.db.encodeName("id")}=${params.name("id")}`, 
                params.prepare(),
            );

            // were there any indexes?
            if (c.indexes && c.indexes.length > 0) {
                await this.db.exec(`
                    DELETE FROM ${this.db.encodeName(this.db.getSearchTableName(container))}
                    WHERE ${this.db.encodeName("id")}=${params.name("id")}`, 
                    params.prepare(),
                );
            }

            if (!changeTracking || changeTracking.track) {
                await this.db.logChange(container, id, {
                    type: "object-delete",
                    container,
                    id,
                });
            }
        } else {
            throw `Item ${container}/${id} not found`;
        }

		await this.notify({
			type: "del",
			options,
		});		

        return true;
    }

    async getIndexes(container: string) {
        info("SqlStore.getIndexes()");
        if (!this.db) throw new NoDatabaseException();

        const params = new QueryParams(this.db);
        params.add("container", container);

        const result = await this.db.getOne(`
            SELECT indexes
            FROM ${this.db.encodeName("schema")} 
            WHERE ${this.db.encodeName("container")} = ${params.name("container")}`, 
            params.prepare()
        );

        return result ? JSON.parse(result.indexes) : undefined;
    }

    async reset(options: {

    }) {
        info("SqlStore.reset()");
        if (!this.db) throw new NoDatabaseException();

        // get all existing tables
        const names = await this.db.getUserTables();
        info("reset: names: " + JSON.stringify(names));
        if (!names) return;

        const ignore: string[] = [
        ];

        for(let row of names) {
            if (ignore.indexOf(row.name) < 0) {
                const sql = `DROP TABLE ${this.db.encodeName(row.name)}`;
                data(sql);
                await this.db.exec(sql);
            }
        }

        return this.db.checkForBaseRequirements();
    }

    // NOTE: search & searchAll will automatically prune sensitive data
    async searchAll(queries: SearchOptions[]) {
        info("SqlStore.searchAll()");
        const results = [];

        for(let q of queries) {
            results.push(this.search(q));
        }

        return Promise.all(results);
    }

    // NOTE: search & searchAll will automatically prune sensitive data
    async search(options: SearchOptions) {
        info("SqlStore.search('" + options.container + "')");
        if (!this.db) throw new NoDatabaseException();

		const db = this.db;

        const crit: string[] = [];
        let paramCounter = 1;

        const returnType = options.returnType ? options.returnType : "ids";

        let qry = options.qry;

		const e: Event = {
			type: "search",
			options,
		};

        // get the props that have been indexed 
        // ... as we parse the query need to confirm that only those are being referenced
        const container = await this.getContainer({ name: options.container });
        const availableIndexes = {
			"id": true, // always can search by id 
		} as any;
        if (container && container.indexes) {
            for(let i=0;i<container.indexes.length;i++) {
                const ind = container.indexes[i];
                availableIndexes[ind.name] = true;
            }
        }
        info("availableIndexes: " + JSON.stringify(availableIndexes));

        const params = new QueryParams(this.db);

        function hasIndex(name: string) {
            return (availableIndexes[name] !== undefined);
        }
        
        function parseComparison(ex: Comparison) {
            if (!hasIndex(ex.prop)) {
                throw `Attempting to query a property '${ex.prop}' in container '${options.container}' that has not been indexed`;
            }

			const comparator = db.getComparator(ex.comparator);

			if (comparator !== "in" && comparator !== "not in") {
				const paramName = "p" + paramCounter++;
				params.addLowercase(paramName, ex.value);
				crit.push(
					"s." + ex.prop.replace(".", "_") + " " + comparator + " " + params.name(paramName),
				);
			} else {
				crit.push("s." + ex.prop.replace(".", "_") + " " + ex.comparator + " (" + ex.value + ")");
			}

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

            // info("qry obj: " + JSON.stringify(qry))
			// data(qry);

            try {
                if (Array.isArray(qry)) {
                    parseComparisonArray(qry);
                } else {
                    parseComparison(qry as any);
                }                
            } catch (e) {
                return {
                    error: e,
                }
            }
        }

		// what is going to be returned?
		let selectFields;
		if (returnType === "count") {
			selectFields = "COUNT(*) as total";
		} else {
			selectFields = `t.id${((returnType !== "ids") ? ", t.value, t.version" : "")}`;
		}

        let sql = `
            SELECT ${selectFields}
            FROM ${this.db.encodeName(options.container)} t
            INNER JOIN ${this.db.encodeName(this.db.getSearchTableName(options.container))} s ON t.id = s.id
        `;
        if (crit.length > 0) {
            sql += ` WHERE ${crit.join("")}`;
        }
		if (options.sort) {
			const orderSql = [];
			for(let s of options.sort) {
				// only allow sort on indexed columns
				// i.e. need to have pulled the data from json into an addressable col
				if (!hasIndex(s.name)) {
					error(`WARNING: Attempt to sort by non-indexed column ${s.name} ignored`);
					continue;
				}
				orderSql.push(`s.${this.db.encodeName(s.name)} ${s.direction === "DESC" ? "DESC" : "ASC"}`);
			}
			if (orderSql.length > 0) {
				sql += ` ORDER BY ${orderSql.join(",")}`;

				// MSSQL requires ORDER BY for OFFSET/FETCH to work, so just make it a default rule across the board
				if (options.maxResults! > 0) {
					const limitSql = this.db.getLimitSql(options.maxResults!)
					sql += limitSql;
				}
			}
		}

		if (returnType === "count") {
			const result: any = await this.db.getOne(sql, params.prepare());
			return {
				count: result ? result.total : 0,
			};
		}

        const items = await this.db.getAll(sql, params.prepare());

		let result;

        function hasRole(name: string) {
            if (!options.roles) return false;
            return (options.roles.indexOf(name) >= 0);
        }

        if (returnType === "ids") {
            // ids
            // do immediately and return result so don't do any prune logic unnecessarily
            result = [] as string[];
            if (items) {
                for(let i of items) {
                    result.push(i.id);
                }
            }

        } else {
			const { isPruneRequired, prune } = await pruneSensitiveData(this, container, hasRole);

			if (returnType === "map") {
				// map
				const map: any = {};
				if (items) {
					for(let item of items) {
						const o = JSON.parse(item.value);
						if (isPruneRequired) prune(o);
						o.version = item.version;
						map[item.id] = o;
					}
				}
				result = map;
	
			} else if (returnType === "array") {
				// array
				result = [];
				if (items) {
					for(let item of items) {
						// expand out the .value to be actual JSON object
						const o = JSON.parse(item.value);
						if (isPruneRequired) prune(o);
						o.version = item.version;
						o.id = item.id;
						result.push(o);
					}    
										
				}
	
			}
	

		}

		e.result = result;
		await this.notify(e);

		return result;
    }

    async getChanges(options: {
        from?: number, // id
        since?: string,
    }) {
        info("SqlStore.getChanges()");
        if (!this.db) throw new NoDatabaseException();

        //let sql = "SELECT id, container, id, change, timestamp FROM changes";
        let sql = "SELECT change FROM changes";

        const params = new QueryParams(this.db);

        const where = [];
        if (options.since) {
            params.add("since", options.since);
            where.push(`timestamp >= ${params.name("since")}`);
        }
        if (options.from) {
            params.add("from_change_id", options.from);
            where.push(`change_id >= ${params.name("from_change_id")}`);
        }
        if (where.length > 0) {
            sql += " WHERE (" + where.join(" AND ") + ")";
        }

        sql += " ORDER BY change_id";

        const items = await this.db.getAll(sql, params.prepare());
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
        info("SqlStore.merge()");

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
                if (change.container && change.id && change.changes) {
                    await this.applyChangesToObject(
                        change.container,
                        change.id,
                        change.changes
                    );
                }

            } else if (change.type === "object-delete") {
                const container = change.container;
                const id = change.id;
                if (container && id) {
                    await this.set(
                        {
                            container,
                            object: {
                                id,
                            },
                        },
                        {
                            track: false, // don't track this change
                        }, 
                    );

                }

            } else if (change.type === 'container-set') {
                await this.setContainer(change.value, { track: false });

            // } else if (change.type === "container-set-schema") {
            //     await this.setSchema(change.value, { track: false });

            }

        }

    }

    async applyChangesToObject(container: string, id: string, changes: Change[]) {
        info("SqlStore.applyChangesToObject()");

        //info(`Applying changes to ${container}/${id}`);

        // get existing value 
        const json = await this.get({ container, ids: [id] });
        if (!json) {
            // object no longer exists
			error("Object no longer exists");
            return;
        }

        const object = JSON.parse(json);
        if (!object) {
			error("JSON not valid")
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
            //info("change: " + JSON.stringify(c));

            if (c.type === 'array-add') {
                const a = getProp(c.prop!);
                if (a) {
                    a.splice(c.index, 0, c.value);
                } else {
                    error("array-add: Not found: " + c.prop);
                }

            } else if (c.type === "array-update") {
                const a = getProp(c.prop!);
                if (a) {
                    for(let i=0;i<a.length;i++) {
                        const elem = a[i];
                        if (elem.id === c.id) {
                            a[i] = c.value;
                            break;
                        }
                    }
                } else {
                    error("array-update: Not found: " + c.prop);
                }

            } else if (c.type === 'array-delete') {
                const a = getProp(c.prop!);
                if (a) {
                    for(let i=0;i<a.length;i++) {
                        const elem = a[i];
                        if (elem.id === c.id) {
                            a.splice(i, 1);
                            break;
                        }
                    }
                } else {
                    error("array-delete: Not found: " + c.prop);
                }

            } else if (c.type === 'array-order') {
                const indexed = [];
                const items = getProp(c.prop!);
                if (items && c.value && c.value.length > 0) {
                    const map = {} as any;
                    for(let item of items) {
                        map[item.id] = item;
                    }
                    const sorted = [];
                    for(let id of c.value) {
                        sorted.push(map[id]);
                    }

                } else {
                    error("array-order: Not found: " + c.prop);
                }

            } else if (c.type === 'prop-add') {
                if (c.prop) {
                    setProp(c.prop, c.value);
                } else {
                    error("prop-add: .prop not provided");
                }

            } else if (c.type === 'prop-delete') {
                if (c.prop) {
                    const parent = getProp(c.prop, true);
                    if (parent) {
                        delete parent[c.prop];
                    }
                } else {
                    error("prop-delete: .prop not provided");
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
                    error("prop-rename: .prop or .value not provided");
                }

            } else if (c.type === 'prop-update') {
                if (c.prop) {
                    setProp(c.prop, c.value);                    
                } else {
                    error("prop-update: .prop not provided");
                }

            }

        }

        // make sure the id is part of the object
        object.id = id;

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

	async createIndex(searchTableName: string, propName: string) {
		if (!this.db) throw new NoDatabaseException();

		const sql = `
			CREATE INDEX 
			${this.db.encodeName("idx_" + searchTableName + "_" + propName)} 
			ON ${this.db.encodeName(searchTableName)}
			(
				${this.db.encodeName(propName)}
			);
		`;

		info(sql);

		await this.db.exec(
			sql
		);
	}

	async notify(e: Event) {
		for(let h of this.listeners) {
			await h(e);
		}
	}

	addEventListener(options: {
		handler: (e: any) => void,
	}) {
		this.listeners.push(options.handler);
	}

	removeEventListener(options: {
		handler: (e: any) => void,
	}) {
		const i = this.listeners.indexOf(options.handler);
		if (i >= 0) this.listeners.splice(i, 1);
	}

}
