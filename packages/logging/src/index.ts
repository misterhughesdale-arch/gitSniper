import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const LEVEL_ORDER: Record<LogLevel, number> = {
  error: 0,
  info: 1,
  debug: 2,
};

type LogLevel = "error" | "info" | "debug";

export interface LoggerOptions {
  level: string;
  destination?: string;
}

export interface StructuredLogEntry {
  level: LogLevel;
  msg: string;
  time: string;
  context: Record<string, unknown>;
}

export interface Logger {
  info: (context: Record<string, unknown>, msg?: string) => void;
  error: (context: Record<string, unknown>, msg?: string) => void;
  debug: (context: Record<string, unknown>, msg?: string) => void;
}

export function createRootLogger(options: LoggerOptions): Logger {
  const normalizedLevel = normalizeLevel(options.level);
  const threshold = LEVEL_ORDER[normalizedLevel];

  const writer = options.destination ? createStream(options.destination) : undefined;

  const log = (level: LogLevel, context: Record<string, unknown>, msg?: string) => {
    if (LEVEL_ORDER[level] > threshold) {
      return;
    }

    const entry: StructuredLogEntry = {
      level,
      msg: msg ?? "",
      time: new Date().toISOString(),
      context,
    };

    const payload = JSON.stringify(entry);
    if (level === "error") {
      console.error(payload);
    } else if (level === "debug") {
      console.debug(payload);
    } else {
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

function normalizeLevel(level: string): LogLevel {
  const lower = level.toLowerCase();
  if (lower === "debug" || lower === "error" || lower === "info") {
    return lower;
  }
  return "info";
}

function createStream(destination: string) {
  const absPath = resolve(process.cwd(), destination);
  const dir = dirname(absPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return createWriteStream(absPath, { flags: "a" });
}
