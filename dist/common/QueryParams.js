"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnknownParamException = exports.QueryParams = void 0;
const rant_utils_1 = require("rant-utils");
const log_1 = require("../log");
class QueryParams {
    db;
    items = [];
    indexes = {};
    constructor(db) {
        this.db = db;
    }
    addLowercase(name, value) {
        const v = (0, rant_utils_1.isString)(value) ? value.toLowerCase() : value;
        this.add(name, v);
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
    setValuesLowercase(values) {
        for (let item of this.items) {
            let v = values[item.name];
            if ((0, rant_utils_1.isString)(v))
                v = v.toLowerCase();
            item.value = v;
        }
    }
    name(name) {
        const i = this.get(name);
        if (!i) {
            (0, log_1.error)("UnknownParamException: " + name);
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
