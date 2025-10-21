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
export declare function createRootLogger(options: LoggerOptions): Logger;
export {};
