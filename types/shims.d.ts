declare module "@grpc/grpc-js" {
  class Metadata {
    add(key: string, value: string): void;
  }

  const credentials: {
    createInsecure(): unknown;
  };

  function loadPackageDefinition(definition: unknown): any;

  export { Metadata, credentials, loadPackageDefinition };
}

declare module "@grpc/proto-loader" {
  interface LoadOptions {
    keepCase?: boolean;
    longs?: string | Function;
    enums?: string | Function;
    defaults?: boolean;
    oneofs?: boolean;
  }

  function loadSync(filename: string | string[], options?: LoadOptions): unknown;

  export { loadSync, LoadOptions };
}

declare module "node:fs" {
  export function readFileSync(path: string, encoding: string): string;
  export function appendFileSync(path: string, data: string, options?: { encoding?: string }): void;
  export function existsSync(path: string): boolean;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): void;
  export function createWriteStream(path: string, options?: { flags?: string }): {
    write(chunk: string): void;
  };
}

declare module "node:path" {
  export function resolve(...paths: string[]): string;
  export function dirname(path: string): string;
}

declare module "events" {
  class EventEmitter {
    on(event: string, listener: (...args: unknown[]) => void): this;
    emit(event: string, ...args: unknown[]): boolean;
    removeAllListeners(): void;
  }

  export { EventEmitter };
}

declare namespace NodeJS {
  // Minimal subset required by the project.
  interface ProcessEnv {
    [key: string]: string | undefined;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
  cwd(): string;
  exitCode?: number;
};

declare const Buffer: {
  from(data: string | Uint8Array | number[], encoding?: string): Uint8Array & {
    toString(encoding?: string): string;
    length: number;
  };
  alloc(size: number): Uint8Array;
};

declare function require(path: string): any;

declare const __dirname: string;

declare function setTimeout(handler: (...args: unknown[]) => void, timeout?: number): number;
declare function clearTimeout(id: number): void;
