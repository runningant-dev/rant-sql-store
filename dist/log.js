"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.error = exports.data = exports.info = exports.log = void 0;
const rant_utils_1 = require("rant-utils");
const pkg = "rant-sql-store";
const cols = {
    info: {
        pkg: "BgGreen",
        message: "FgGreen",
    },
    data: {
        pkg: "BgCyan",
        message: "FgCyan",
    },
    error: {
        pkg: "BgRed",
        message: "FgRed",
    }
};
function log(message, severity) {
    console.log((0, rant_utils_1.colorText)(pkg + ": " + message, cols[severity]));
}
exports.log = log;
function info(message) {
    log(message, "info");
}
exports.info = info;
function data(data) {
    if ((0, rant_utils_1.isObject)(data)) {
        log(JSON.stringify(data), "data");
    }
    else {
        log(data, "data");
    }
}
exports.data = data;
function error(message) {
    log(message, "error");
}
exports.error = error;
