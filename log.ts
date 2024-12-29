import { colorText } from "rant-utils";

const pkg = "rant-sql-store";

const cols = {
	info: "BgGreen",
	error: "BgRed",
};

export function log(message: string, severity: "info" | "error") {
	console.log(colorText(pkg + ": " + message, cols[severity] as any));
}

export function info(message: string) {
	log(message, "info");
}

export function error(message: string) {
	log(message, "error");
}
