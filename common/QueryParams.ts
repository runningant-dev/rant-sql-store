import { SqlDB } from "./SqlDB";

export interface QueryParam {
    index: number,
    name: string,
    value: any,
}

export class QueryParams {
    db: SqlDB;
    items: QueryParam[] = [];
    indexes: any = {};

    constructor(db: SqlDB) {
        this.db = db;
    }

    add(name: string, value?: any) {
        const item = {
            index: this.items.length,
            name,
            value,
        };
        this.indexes[item.name] = this.items.length;
        this.items.push(item);
        return item;
    }
    get(name: string) {
        const i = this.indexes[name];
        if (i >= 0) return this.items[i];
        return undefined;
    }
    setValue(name: string, value: any) {
        const i = this.indexes[name];
        if (i >= 0) {
            const item = this.items[i];
            item.value = value;
        }
    }
    setValues(values: any) {
        for(let item of this.items) {
            item.value = values[item.name];
        }
    }

    name(name: string) {
        const i = this.get(name);
        if (!i) {
            console.log("UnknownParamException: " + name);
            throw new UnknownParamException();
        }
        return this.db.formatParamName(i);
    }

    prepare() {
        return this.db.prepareParams(this);
    }

}

export class UnknownParamException {

}