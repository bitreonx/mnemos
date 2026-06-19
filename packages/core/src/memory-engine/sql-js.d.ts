declare module 'sql.js' {
  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => {
      run(sql: string, params?: unknown[]): void;
      prepare(sql: string): {
        bind(params?: unknown[]): void;
        step(): boolean;
        getAsObject(): Record<string, unknown>;
        free(): void;
      };
      close(): void;
      export(): Uint8Array;
    };
  }
  export default function initSqlJs(config?: { locateFile?: (file: string) => string }): Promise<SqlJsStatic>;
}

declare module 'node:sqlite' {
  export class DatabaseSync {
    constructor(path: string);
    prepare(sql: string): {
      run(...params: unknown[]): void;
      all(...params: unknown[]): Record<string, unknown>[];
    };
    close(): void;
  }
}
