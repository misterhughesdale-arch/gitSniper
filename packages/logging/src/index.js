"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRootLogger = createRootLogger;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const LEVEL_ORDER = {
    error: 0,
    info: 1,
    debug: 2,
};
function createRootLogger(options) {
    const normalizedLevel = normalizeLevel(options.level);
    const threshold = LEVEL_ORDER[normalizedLevel];
    const writer = options.destination ? createStream(options.destination) : undefined;
    const log = (level, context, msg) => {
        if (LEVEL_ORDER[level] > threshold) {
            return;
        }
        const entry = {
            level,
            msg: msg ?? "",
            time: new Date().toISOString(),
            context,
        };
        const payload = JSON.stringify(entry);
        if (level === "error") {
            console.error(payload);
        }
        else if (level === "debug") {
            console.debug(payload);
        }
        else {
            console.log(payload);
        }
        writer?.write(`${payload}\n`);
    };
    return {
        info: (context, msg) => log("info", context, msg),
        error: (context, msg) => log("error", context, msg),
        debug: (context, msg) => log("debug", context, msg),
    };
}
function normalizeLevel(level) {
    const lower = level.toLowerCase();
    if (lower === "debug" || lower === "error" || lower === "info") {
        return lower;
    }
    return "info";
}
function createStream(destination) {
    const absPath = (0, node_path_1.resolve)(process.cwd(), destination);
    const dir = (0, node_path_1.dirname)(absPath);
    if (!(0, node_fs_1.existsSync)(dir)) {
        (0, node_fs_1.mkdirSync)(dir, { recursive: true });
    }
    return (0, node_fs_1.createWriteStream)(absPath, { flags: "a" });
}
