declare module "better-sqlite3" {
  namespace Database {
    interface Statement {
      run(...params: unknown[]): { lastInsertRowid: number | bigint };
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
    }

    interface Database {
      pragma(source: string): void;
      exec(source: string): void;
      prepare(source: string): Statement;
      transaction<T extends (...args: never[]) => unknown>(fn: T): T;
    }
  }

  class BetterSqlite3Database implements Database.Database {
    constructor(path: string);
    pragma(source: string): void;
    exec(source: string): void;
    prepare(source: string): Database.Statement;
    transaction<T extends (...args: never[]) => unknown>(fn: T): T;
  }

  export = BetterSqlite3Database;
}
