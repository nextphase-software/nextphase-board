// SPDX-License-Identifier: Apache-2.0
import * as Y from "yjs";
import { canonical } from "nextphase-board-rules/document.ts";
import type { BoardV10 } from "nextphase-board-rules/document.ts";
import { bytes } from "./protocol.ts";
import type { Storage } from "./storage.ts";
const CHUNK = 1048576;
export function snapshot(storage: Storage, doc: Y.Doc, board: BoardV10, revision: number) {
  for (const [kind, value] of [["json", bytes(canonical(board))], ["yjs", Y.encodeStateAsUpdate(doc)]] as const) {
    storage.exec("DELETE FROM snapshot_chunks WHERE snapshot_revision = ? AND kind = ?", revision, kind);
    for (let offset = 0, index = 0; offset < value.length; offset += CHUNK, index++) {
      storage.exec("INSERT INTO snapshot_chunks VALUES (?, ?, ?, ?)", revision, kind, index, value.slice(offset, offset + CHUNK));
    }
  }
  const revisions = storage.all("SELECT DISTINCT snapshot_revision FROM snapshot_chunks ORDER BY snapshot_revision DESC");
  if (revisions.length > 1) {
    const previous = Number(revisions[1].snapshot_revision);
    storage.exec("DELETE FROM snapshot_chunks WHERE snapshot_revision < ?", previous);
    storage.exec("DELETE FROM edits WHERE revision <= ?", previous);
  }
}
export function newestSnapshot(storage: Storage): number {
  return Number(storage.all("SELECT MAX(snapshot_revision) AS revision FROM snapshot_chunks")[0]?.revision ?? -1);
}
export function loadDocument(storage: Storage): Y.Doc {
  const doc = new Y.Doc();
  const revision = newestSnapshot(storage);
  const chunks = storage.all("SELECT bytes FROM snapshot_chunks WHERE snapshot_revision = ? AND kind = 'yjs' ORDER BY chunk_index", revision);
  if (chunks.length) {
    const parts = chunks.map((row) => row.bytes as Uint8Array);
    const update = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
    let offset = 0;
    for (const part of parts) { update.set(part, offset); offset += part.length; }
    Y.applyUpdate(doc, update);
  }
  for (const row of storage.all('SELECT "update" FROM edits WHERE revision > ? ORDER BY revision', revision)) {
    Y.applyUpdate(doc, row.update as Uint8Array);
  }
  return doc;
}
