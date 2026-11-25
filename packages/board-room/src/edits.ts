// SPDX-License-Identifier: Apache-2.0
import { held, isPictureType, isVideoType } from "./pictures.ts";
import * as Y from "yjs";
import { readBoard } from "nextphase-board-sync/codec.ts";
import { canonical, validate, type BoardV14 } from "nextphase-board-rules/document.ts";
import { checkTransition } from "nextphase-board-rules/transition.ts";
import { isImage, isLink, isVideo } from "nextphase-board-rules/objects/registry.ts";
import { createEncoder, toUint8Array } from "lib0/encoding";
import { createDecoder } from "lib0/decoding";
import { writeUpdate, readSyncMessage } from "y-protocols/sync";
import type { Storage } from "./storage.ts";
import { promote } from "./conflicts.ts";
import { repair } from "./repair.ts";
export type EditResult = { kind: "waiting" } | { kind: "refused"; reason: string } |
  { kind: "complete"; doc: Y.Doc; board: BoardV14; update: Uint8Array; changed: boolean;
    identifiers: { id: string; generation: string }[] };

export function evaluate(doc: Y.Doc, before: BoardV14, update: Uint8Array, storage: Storage): EditResult {
  const candidate = new Y.Doc();
  // Establish root types before integrating items, so their parent references
  // are the same maps that the mapping and conflict rules inspect.
  for (const name of ["board", "objects", "retired"]) candidate.getMap(name);
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
    let changed = promote(doc, candidate, update);
    let after: ReturnType<typeof readBoard>;
    try { after = readBoard(candidate); } catch { return { kind: "refused", reason: "invalid_update" }; }
    if (after.schemaVersion !== 16) return { kind: "refused", reason: "invalid_document" };
    const pages = after.pages;
    if (after.objects.some(o => !pages.some(p => p.id === o.page))) return { kind: "refused", reason: "invalid_document" };
    const repaired = repair(candidate, before, after);
    changed ||= repaired.changed;
    if (repaired.changed) after = readBoard(candidate);
    try {
      validate(after);
      if (after.schemaVersion !== 16) throw Error();
    } catch { return { kind: "refused", reason: "invalid_document" }; }
    try { canonical(after); } catch { return { kind: "refused", reason: "document_too_large" }; }
    try { checkTransition(before, after); } catch { return { kind: "refused", reason: "invalid_transition" }; }
    const previous = new Set(before.objects.map((object) => object.id));
    const identifiers = [...after.objects, ...repaired.removed].filter((object) => !previous.has(object.id));
    for (const object of identifiers) {
      if (!previous.has(object.id) && storage.all(
        "SELECT object_id FROM identifiers WHERE object_id IN (?, ?) OR generation IN (?, ?)",
        object.id, object.generation, object.id, object.generation).length) {
        return { kind: "refused", reason: "identifier_reused" };
      }
    }
    const media = new Map(before.objects.map(o => [o.id, o]));
    for (const object of after.objects) {
      if (!isImage(object) && !isVideo(object) && !isLink(object) || object.asset === null) continue;
      const prior = media.get(object.id);
      if (prior?.type === object.type && "asset" in prior && prior.asset === object.asset &&
          (!isVideo(object) || isVideo(prior) && object.poster === prior.poster)) continue;
      const type = held(storage, object.asset)?.type;
      if (isVideo(object) ? !isVideoType(type) || held(storage, object.poster)?.type !== "image/jpeg" : !isPictureType(type)) {
        return { kind: "refused", reason: "asset_missing" };
      }
    }
    retained = true;
    return { kind: "complete", doc: candidate, board: after, changed, identifiers,
      update: Y.encodeStateAsUpdate(candidate, Y.encodeStateVector(doc)) };
  } catch { return { kind: "refused", reason: "invalid_update" }; }
  finally { if (!retained) candidate.destroy(); }
}
