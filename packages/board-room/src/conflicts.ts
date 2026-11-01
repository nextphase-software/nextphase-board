// SPDX-License-Identifier: Apache-2.0
import * as Y from "yjs";

// Yjs orders concurrent map assignments by client ID. The room instead gives
// each incoming assignment the next place in its save order, including equal
// values. Decode the submitted bytes: a losing item's value may already have
// been garbage collected in the integrated candidate.
export function promote(before: Y.Doc, candidate: Y.Doc, update: Uint8Array): boolean {
  const vector = Y.decodeStateVector(Y.encodeStateVector(before));
  const assignments = new Map<Y.Map<unknown>, Map<string, unknown>>();
  for (const struct of Y.decodeUpdate(update).structs) {
    if (!(struct instanceof Y.Item) || struct.id.clock < (vector.get(struct.id.client) ?? 0)) continue;
    let parent: unknown;
    let key = struct.parentSub;
    if (typeof struct.parent === "string") parent = candidate.getMap(struct.parent);
    else if (struct.parent instanceof Y.ID) {
      const item = Y.getItem(candidate.store, struct.parent);
      if (item instanceof Y.Item && item.content instanceof Y.ContentType) parent = item.content.type;
    } else {
      // Incremental map writes encode their parent through an origin.
      const origin = struct.origin ?? struct.rightOrigin;
      if (origin) {
        const item = Y.getItem(candidate.store, origin);
        parent = item.parent;
        key = item.parentSub;
      }
    }
    if (!(parent instanceof Y.Map) || key === null || key === "text" ||
      parent === candidate.getMap("objects") || parent === candidate.getMap("retired")) continue;
    if (parent !== candidate.getMap("board")) {
      const item = parent._item;
      if (!item || item.deleted || item.parent !== candidate.getMap("objects")) continue;
    }
    const content = struct.content.getContent();
    if (!content.length || struct.content instanceof Y.ContentType) continue;
    let values = assignments.get(parent);
    if (!values) { values = new Map(); assignments.set(parent, values); }
    values.set(key, content[content.length - 1]);
  }
  let changed = false;
  candidate.transact(() => {
    for (const [map, values] of assignments) for (const [key, value] of values) {
      const current = map._map.get(key);
      // The incoming winner already has a fresh identity. Only a losing write
      // needs promotion; always writing would needlessly enlarge every save.
      if (current && current.id.clock >= (vector.get(current.id.client) ?? 0) &&
        JSON.stringify(map.get(key)) === JSON.stringify(value)) continue;
      map.set(key, value);
      changed = true;
    }
  });
  return changed;
}
