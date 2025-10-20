import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type FreshSniperConfig, validateConfigWithZod } from "./schema";

export type { FreshSniperConfig };

export interface LoadConfigOptions {
  environmentName?: string;
  configDirectory?: string;
  env?: NodeJS.ProcessEnv;
}

type UnknownRecord = Record<string, unknown>;

export function loadConfig(options: LoadConfigOptions = {}): FreshSniperConfig {
  const env = options.env ?? process.env;
  const configDir = resolve(process.cwd(), options.configDirectory ?? "config");

  const defaultConfig = readToml(resolve(configDir, "default.toml"));
  const envName =
    options.environmentName ??
    env.FRESH_SNIPER_ENV ??
    (getNested(defaultConfig, ["environment", "name"]) as string | undefined) ??
    "production";

  const environmentPath = resolve(configDir, `${envName}.toml`);
  const environmentConfig = existsSync(environmentPath) ? readToml(environmentPath) : {};

  const merged = deepMerge(defaultConfig, environmentConfig);
  const hydrated = substituteEnvPlaceholders(merged, env);

  // Use Zod validation for comprehensive type checking and defaults
  return validateConfigWithZod(hydrated);
}

function readToml(path: string): UnknownRecord {
  const raw = readFileSync(path, "utf8");
  return parseSimpleToml(raw);
}

function parseSimpleToml(raw: string): UnknownRecord {
  const result: UnknownRecord = {};
  let currentPath: string[] = [];

  const lines = raw.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }

    if (line.startsWith("[") && line.endsWith("]")) {
      const section = line.slice(1, -1).trim();
      currentPath = section.split(".");
      ensurePath(result, currentPath);
      continue;
    }

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) {
      throw new Error(`Invalid TOML line: ${line}`);
    }

    const key = line.slice(0, eqIndex).trim();
    const rawValue = line.slice(eqIndex + 1).trim();
    const value = parseValue(rawValue);

    setNested(result, [...currentPath, key], value);
  }

  return result;
}

function parseValue(raw: string): unknown {
  if (raw.startsWith("\"") && raw.endsWith("\"")) {
    return raw.slice(1, -1);
  }

  if (raw === "true") return true;
  if (raw === "false") return false;

  if (raw.startsWith("[") && raw.endsWith("]")) {
    const inner = raw.slice(1, -1).trim();
    if (inner === "") return [];
    return splitArrayValues(inner).map((item) => parseValue(item.trim()));
  }

  const numeric = Number(raw);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }

  return raw;
}

function splitArrayValues(value: string): string[] {
  const parts: string[] = [];
  let buffer = "";
  let inQuotes = false;

  for (const char of value) {
    if (char === "\"") {
      inQuotes = !inQuotes;
      buffer += char;
      continue;
    }

    if (char === "," && !inQuotes) {
      parts.push(buffer.trim());
      buffer = "";
      continue;
    }

    buffer += char;
  }

  if (buffer !== "") {
    parts.push(buffer.trim());
  }

  return parts;
}

function ensurePath(target: UnknownRecord, path: string[]): void {
  let cursor: UnknownRecord = target;
  for (const segment of path) {
    if (!(segment in cursor)) {
      cursor[segment] = {};
    }
    const next = cursor[segment];
    if (typeof next !== "object" || next === null || Array.isArray(next)) {
      throw new Error(`Cannot create section for ${segment}`);
    }
    cursor = next as UnknownRecord;
  }
}

function setNested(target: UnknownRecord, path: string[], value: unknown): void {
  let cursor: UnknownRecord = target;
  path.slice(0, -1).forEach((segment) => {
    if (!(segment in cursor)) {
      cursor[segment] = {};
    }
    const next = cursor[segment];
    if (typeof next !== "object" || next === null || Array.isArray(next)) {
      throw new Error(`Cannot set nested value for ${segment}`);
    }
    cursor = next as UnknownRecord;
  });

  const lastKey = path[path.length - 1];
  cursor[lastKey] = value;
}

function getNested(target: UnknownRecord, path: string[]): unknown {
  return path.reduce<unknown>((acc, segment) => {
    if (typeof acc !== "object" || acc === null || Array.isArray(acc)) {
      return undefined;
    }
    return (acc as UnknownRecord)[segment];
  }, target);
}

function deepMerge(base: UnknownRecord, overlay: UnknownRecord): UnknownRecord {
  const result: UnknownRecord = { ...base };

  for (const [key, value] of Object.entries(overlay)) {
    const existing = result[key];

    if (isRecord(existing) && isRecord(value)) {
      result[key] = deepMerge(existing, value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

function substituteEnvPlaceholders<T>(value: T, env: NodeJS.ProcessEnv): T {
  if (typeof value === "string") {
    return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name: string) => {
      const resolved = env[name];
      if (resolved === undefined) {
        throw new Error(`Missing environment variable ${name} referenced in config`);
      }
      return resolved;
    }) as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => substituteEnvPlaceholders(item, env)) as unknown as T;
  }

  if (isRecord(value)) {
    const mapped = Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, substituteEnvPlaceholders(item, env)]),
    );
    return mapped as T;
  }

  return value;
}


function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
