"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.error = exports.info = exports.log = void 0;
const rant_utils_1 = require("rant-utils");
const pkg = "rant-sql-store";
const cols = {
    info: "BgGreen",
    error: "BgRed",
};
function log(message, severity) {
    console.log((0, rant_utils_1.colorText)(pkg + ": " + message, cols[severity]));
}
exports.log = log;
function info(message) {
    log(message, "info");
}
exports.info = info;
function error(message) {
    log(message, "error");
}
exports.error = error;
