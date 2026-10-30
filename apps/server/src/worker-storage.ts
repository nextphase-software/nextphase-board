// SPDX-License-Identifier: Apache-2.0
import type { Row, Storage, Value } from "nextphase-board-room/storage.ts";
export class WorkerStorage implements Storage {
  storage: DurableObjectStorage;
  constructor(storage: DurableObjectStorage) { this.storage = storage; }
  all(sql: string, ...bindings: Value[]): Row[] {
    return this.storage.sql.exec(sql, ...bindings).toArray().map((row) => Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, value instanceof ArrayBuffer ? new Uint8Array(value) : value]))) as Row[];
  }
  exec(sql: string, ...bindings: Value[]) { this.storage.sql.exec(sql, ...bindings); }
  transaction<T>(operation: () => T): T { return this.storage.transactionSync(operation); }
}
