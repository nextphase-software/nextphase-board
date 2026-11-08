// SPDX-License-Identifier: Apache-2.0
import { mentionProblem } from "nextphase-board-sync/mentions.ts";
import { textProblem } from "nextphase-board-sync/comments.ts";
import type { RoomEnvironment } from "./interfaces.ts";
import { base64, bytes, RoomError, unbase64 } from "./protocol.ts";
import { resetTimer } from "./timer.ts";
import { meta, binaryColumns, insert, tables, type Row } from "./storage.ts";
export type Envelope = {
  format: "nextphase-board-room-backup"; version: 1; boardId: string; createdAt: string;
  tables: Record<string, Row[]>;
};
const metaKeys = ["storage_version","board_id","last_edit_at","revision","watermark","restore_generation","restore_pending","mention_order","mention_cleanup","history_ordinal","history_revision","history_capture_sha256","history_capture_bytes","history_next_at","comment_sequence","copied"];
const names = Object.keys(tables).filter((table) => !["waiting", "tickets", "workshop_timer"].includes(table));
export function backup(env: RoomEnvironment, board: string): Envelope {
  if (meta(env.storage, "restore_pending") || meta(env.storage, "explicit_recovery_pending")) throw new RoomError(503, "restore_pending");
  const output = { format: "nextphase-board-room-backup" as const, version: 1 as const,
    boardId: board, createdAt: new Date(env.now()).toISOString(), tables: {} as Record<string, Row[]> };
  for (const name of names) {
    output.tables[name] = env.storage.all(`SELECT * FROM "${name}"`).filter(row => name !== "meta" || !["explicit_recovery_pending", "explicit_recovery_generation"].includes(String(row.key))).map((row) =>
      Object.fromEntries(Object.entries(row).map(([key, value]) =>
        [key, key === binaryColumns[name] ? base64(value as Uint8Array) : value])));
  }
  if (bytes(JSON.stringify(output)).length > env.backupLimit) throw new RoomError(413, "backup_too_large");
  return output;
}
export function decodeBackup(value: unknown, board: string): Envelope {
  const envelope = value as Envelope;
  if (!envelope || Object.keys(envelope).sort().join() !== ["format","version","boardId","createdAt","tables"].sort().join() || envelope.format !== "nextphase-board-room-backup" || envelope.version !== 1 ||
    envelope.boardId !== board || typeof envelope.createdAt !== "string" || !envelope.tables ||
    !Array.isArray(envelope.tables.meta)) throw new RoomError(400, "bad_request");
  const version = envelope.tables.meta.find((row) => row && row.key === "storage_version")?.value;
  const accepted = names;
  if (version !== 6 || Object.keys(envelope.tables).sort().join() !== [...accepted].sort().join()) {
    throw new RoomError(400, "bad_request");
  }
  const decoded = { ...envelope, tables: {} as Record<string, Row[]> };
  try {
    for (const name of accepted) {
      if (!Array.isArray(envelope.tables[name])) throw Error();
      decoded.tables[name] = envelope.tables[name].map((row) => {
        const columns = tables[name];
        if (!row || Object.keys(row).sort().join() !== [...columns].sort().join()) throw Error();
        const result: Row = { ...row };
        for (const [key, value] of Object.entries(result)) {
          if (key === binaryColumns[name]) result[key] = unbase64(value);
          else if (value !== null && typeof value !== "number" && typeof value !== "string") throw Error();
        }
        if (name === "meta" && (typeof result.key !== "string" || !metaKeys.includes(result.key))) throw Error();
        if (name === "comments" && (typeof result.text !== "string" || typeof result.mentions !== "string" ||
          textProblem(result.text) || mentionProblem(result.text, JSON.parse(result.mentions)))) throw Error();
        return result;
      });
    }
  } catch { throw new RoomError(400, "bad_request"); }
  return decoded;
}
export function replace(env: RoomEnvironment, envelope: Envelope) {
  env.storage.transaction(() => {
    for (const name of Object.keys(tables)) env.storage.exec(`DELETE FROM "${name}"`);
    for (const name of names) for (const row of envelope.tables[name] ?? []) insert(env.storage, name, row);
    resetTimer(env.storage);
  });
}
