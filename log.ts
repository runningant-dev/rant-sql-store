import { colorText, isObject, isString } from "rant-utils";

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

export function log(message: string, severity: "info" | "data" | "error") {
	console.log(colorText(pkg + ": " + message, cols[severity] as any));
}

export function info(message: string) {
	log(message, "info");
}

export function data(data: any) {
	if (isObject(data)) {
		log(JSON.stringify(data), "data");
	} else {
		log(data, "data");
	}
}

export function error(message: string) {
	log(message, "error");
}
