// SPDX-License-Identifier: Apache-2.0
import { DatabaseSync } from "node:sqlite";
import type { Row, Storage, Value } from "nextphase-board-room/storage.ts";
export class NodeStorage implements Storage {
  database: DatabaseSync;
  constructor(path: string) {
    this.database = new DatabaseSync(path);
    this.database.exec("PRAGMA journal_mode = WAL");
  }
  all(sql: string, ...bindings: Value[]): Row[] {
    return this.database.prepare(sql).all(...bindings) as Row[];
  }
  exec(sql: string, ...bindings: Value[]) { this.database.prepare(sql).run(...bindings); }
  transaction<T>(operation: () => T): T {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.database.exec("COMMIT");
      return result;
    } catch (error) { this.database.exec("ROLLBACK"); throw error; }
  }
  close() { this.database.close(); }
}
