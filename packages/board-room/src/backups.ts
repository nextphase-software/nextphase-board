// SPDX-License-Identifier: Apache-2.0
import type { RoomEnvironment } from "./interfaces.ts";
import { base64, bytes, RoomError, unbase64 } from "./protocol.ts";
import { binaryColumns, insert, tables, type Row } from "./storage.ts";
export type Envelope = {
  format: "nextphase-board-room-backup"; version: 1; boardId: string; createdAt: string;
  tables: Record<string, Row[]>;
};
const names = Object.keys(tables).filter((table) => !["waiting", "tickets"].includes(table));
export function backup(env: RoomEnvironment, board: string): Envelope {
  const output = { format: "nextphase-board-room-backup" as const, version: 1 as const,
    boardId: board, createdAt: new Date(env.now()).toISOString(), tables: {} as Record<string, Row[]> };
  for (const name of names) {
    output.tables[name] = env.storage.all(`SELECT * FROM "${name}"`).map((row) =>
      Object.fromEntries(Object.entries(row).map(([key, value]) =>
        [key, key === binaryColumns[name] ? base64(value as Uint8Array) : value])));
  }
  if (bytes(JSON.stringify(output)).length > env.backupLimit) throw new RoomError(413, "backup_too_large");
  return output;
}
export function decodeBackup(value: unknown, board: string): Envelope {
  const envelope = value as Envelope;
  if (!envelope || envelope.format !== "nextphase-board-room-backup" || envelope.version !== 1 ||
    envelope.boardId !== board || typeof envelope.createdAt !== "string" || !envelope.tables ||
    Object.keys(envelope.tables).sort().join() !== [...names].sort().join()) throw new RoomError(400, "bad_request");
  const decoded = { ...envelope, tables: {} as Record<string, Row[]> };
  try {
    for (const name of names) {
      if (!Array.isArray(envelope.tables[name])) throw Error();
      decoded.tables[name] = envelope.tables[name].map((row) => {
        if (!row || Object.keys(row).sort().join() !== [...tables[name]].sort().join()) throw Error();
        const result = { ...row };
        for (const [key, value] of Object.entries(result)) {
          if (key === binaryColumns[name]) result[key] = unbase64(value);
          else if (value !== null && typeof value !== "number" && typeof value !== "string") throw Error();
        }
        return result;
      });
    }
  } catch { throw new RoomError(400, "bad_request"); }
  return decoded;
}
export function replace(env: RoomEnvironment, envelope: Envelope) {
  env.storage.transaction(() => {
    for (const name of Object.keys(tables)) env.storage.exec(`DELETE FROM "${name}"`);
    for (const name of names) for (const row of envelope.tables[name]) insert(env.storage, name, row);
  });
}
