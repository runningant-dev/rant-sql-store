import { colorText } from "rant-utils";

const pkg = require("./package.json");

// import * as pkg from "./package.json";

const cols = {
	info: "BgGreen",
	error: "BgRed",
};

export function log(message: string, severity: "info" | "error") {
	console.log(colorText(pkg.name + ": " + message, cols[severity] as any));
}

export function info(message: string) {
	log(message, "info");
}

export function error(message: string) {
	log(message, "error");
}
