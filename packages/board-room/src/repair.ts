// SPDX-License-Identifier: Apache-2.0
import * as Y from "yjs";
import type { BoardV12, ItemV12 } from "nextphase-board-rules/document.ts";
import { hasEnds, hasText, isMindNode, type MindNodeKeys } from "nextphase-board-rules/objects/registry.ts";
import { normalize } from "nextphase-board-rules/marks.ts";

export function repair(doc: Y.Doc, before: BoardV12, merged: BoardV12) {
  const removed: ItemV12[] = [];
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
    for (const [id, values] of mindNodeRepairs(remaining)) {
      const map = objects.get(id)!;
      for (const [key, value] of Object.entries(values)) if (map.get(key) !== value) { map.set(key, value); changed = true; }
    }
    remaining.sort((a, b) => a.order - b.order || Number(previous.has(b.id)) - Number(previous.has(a.id)) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    remaining.forEach((object, order) => {
      if (object.order !== order) { objects.get(object.id)!.set("order", order); changed = true; }
    });
  });
  return { changed, removed };
}

type Structure = Pick<MindNodeKeys, "parent" | "side" | "collapsed">;
// Document v16's repair order. It only changes parents, sides and collapse
// states; it never moves a node (the map's next change lays it out).
export function mindNodeRepairs(objects: readonly ItemV12[]): Map<string, Structure> {
  const nodes = new Map(objects.filter(isMindNode).map((o): [string, Structure] => [o.id, { parent: o.parent, side: o.side, collapsed: o.collapsed }]));
  for (const node of nodes.values()) if (node.parent !== null && !nodes.has(node.parent)) node.parent = null;
  for (let loop = cycle(nodes); loop; loop = cycle(nodes)) {
    nodes.get(loop.reduce((a, b) => a < b ? a : b))!.parent = null;
  }
  for (const node of nodes.values()) {
    if (node.parent === null) { node.side = null; node.collapsed = false; }
    else if (nodes.get(node.parent)!.parent === null) node.side ??= "right";
    else node.side = null;
  }
  return nodes;
}
function cycle(nodes: ReadonlyMap<string, Structure>): string[] | undefined {
  const settled = new Set<string>();
  for (const start of nodes.keys()) {
    const path: string[] = [];
    let id: string | null = start;
    while (id !== null && !settled.has(id)) {
      const at = path.indexOf(id);
      if (at >= 0) return path.slice(at);
      path.push(id);
      id = nodes.get(id)!.parent;
    }
    for (const visited of path) settled.add(visited);
  }
  return undefined;
}
