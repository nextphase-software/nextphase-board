// SPDX-License-Identifier: Apache-2.0
import * as Y from "yjs";
import { readBoard } from "nextphase-board-sync/codec.ts";
import { canonical, validate, type BoardV10 } from "nextphase-board-rules/document.ts";
import { checkTransition } from "nextphase-board-rules/transition.ts";
import { isImage } from "nextphase-board-rules/objects/registry.ts";
import { createEncoder, toUint8Array } from "lib0/encoding";
import { createDecoder } from "lib0/decoding";
import { writeUpdate, readSyncMessage } from "y-protocols/sync";
import type { Storage } from "./storage.ts";
export type EditResult = { kind: "waiting" } | { kind: "refused"; reason: string } |
  { kind: "complete"; doc: Y.Doc; board: BoardV10 };

export function evaluate(doc: Y.Doc, before: BoardV10, update: Uint8Array, storage: Storage): EditResult {
  const candidate = new Y.Doc();
  let retained = false;
  try {
    Y.applyUpdate(candidate, Y.encodeStateAsUpdate(doc));
    // Use the standard update reader. Its error callback makes decode failures
    // explicit; the room never treats partially decoded input as a saved edit.
    const encoded = createEncoder();
    writeUpdate(encoded, update);
    const decoder = createDecoder(toUint8Array(encoded));
    readSyncMessage(decoder, createEncoder(), candidate, null, (error) => { throw error; });
    if (candidate.store.pendingStructs || candidate.store.pendingDs) return { kind: "waiting" };
    let after: BoardV10;
    try { after = readBoard(candidate); } catch { return { kind: "refused", reason: "invalid_update" }; }
    try {
      validate(after);
      if (after.schemaVersion !== 10) throw Error();
    } catch { return { kind: "refused", reason: "invalid_document" }; }
    try { canonical(after); } catch { return { kind: "refused", reason: "document_too_large" }; }
    try { checkTransition(before, after); } catch { return { kind: "refused", reason: "invalid_transition" }; }
    const previous = new Set(before.objects.map((object) => object.id));
    for (const object of after.objects) {
      if (!previous.has(object.id) && storage.all(
        "SELECT object_id FROM identifiers WHERE object_id IN (?, ?) OR generation IN (?, ?)",
        object.id, object.generation, object.id, object.generation).length) {
        return { kind: "refused", reason: "identifier_reused" };
      }
    }
    if (after.objects.some(isImage)) return { kind: "refused", reason: "images_not_supported" };
    retained = true;
    return { kind: "complete", doc: candidate, board: after };
  } catch { return { kind: "refused", reason: "invalid_update" }; }
  finally { if (!retained) candidate.destroy(); }
}
