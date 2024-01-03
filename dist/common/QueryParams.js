"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnknownParamException = exports.QueryParams = void 0;
class QueryParams {
    db;
    items = [];
    indexes = {};
    constructor(db) {
        this.db = db;
    }
    add(name, value) {
        const item = {
            index: this.items.length,
            name,
            value,
        };
        this.indexes[item.name] = this.items.length;
        this.items.push(item);
        return item;
    }
    get(name) {
        const i = this.indexes[name];
        if (i >= 0)
            return this.items[i];
        return undefined;
    }
    setValue(name, value) {
        const i = this.indexes[name];
        if (i >= 0) {
            const item = this.items[i];
            item.value = value;
        }
    }
    setValues(values) {
        for (let item of this.items) {
            item.value = values[item.name];
        }
    }
    name(name) {
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
exports.QueryParams = QueryParams;
class UnknownParamException {
}
exports.UnknownParamException = UnknownParamException;
