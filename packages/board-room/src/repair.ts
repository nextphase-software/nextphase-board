// SPDX-License-Identifier: Apache-2.0
import * as Y from "yjs";
import type { BoardV10, ItemV10 } from "nextphase-board-rules/document.ts";
import { hasEnds, hasText } from "nextphase-board-rules/objects/registry.ts";
import { normalize } from "nextphase-board-rules/marks.ts";

export function repair(doc: Y.Doc, before: BoardV10, merged: BoardV10) {
  const removed: ItemV10[] = [];
  let changed = false;
  const objects = doc.getMap<Y.Map<unknown>>("objects");
  const live = new Set(merged.objects.map((object) => object.id));
  const previous = new Set(before.objects.map((object) => object.id));
  doc.transact(() => {
    // Restates the local delete cascade without importing the web program.
    for (const object of merged.objects) {
      if (hasEnds(object) && (!live.has(object.from.object) || !live.has(object.to.object))) {
        objects.delete(object.id);
        doc.getMap("retired").set(object.generation, true);
        removed.push(object); changed = true;
      } else if (object.section && !live.has(object.section)) {
        objects.get(object.id)!.set("section", null); changed = true;
      }
    }
    const gone = new Set(removed.map((object) => object.id));
    const remaining = merged.objects.filter((object) => !gone.has(object.id));
    for (const object of remaining) if (hasText(object)) {
      const marks = normalize(object.marks, Array.from(object.text).length);
      if (JSON.stringify(marks) !== JSON.stringify(object.marks)) {
        objects.get(object.id)!.set("marks", marks); changed = true;
      }
    }
    remaining.sort((a, b) => a.order - b.order || Number(previous.has(b.id)) - Number(previous.has(a.id)) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    remaining.forEach((object, order) => {
      if (object.order !== order) { objects.get(object.id)!.set("order", order); changed = true; }
    });
  });
  return { changed, removed };
}
