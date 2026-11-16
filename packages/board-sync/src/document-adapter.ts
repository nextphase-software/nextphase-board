// SPDX-License-Identifier: Apache-2.0
import * as Y from "yjs";
import { orderWrites, rebalance } from "./order-keys.ts";
import { markOf, styleOf, upgrade, type Board } from "nextphase-board-rules/document.ts";
import { connectorStyleOf, extraValues, hasEnds, hasRectangle, hasText, isImage } from "nextphase-board-rules/objects/registry.ts";
export class Adapter {
  doc = new Y.Doc();
  set(input: Board, movedPages?: readonly string[], pageOrders?: ReadonlyMap<string, string>) {
    const b = upgrade(input);
    this.doc.transact(() => {
      const board = this.doc.getMap("board");
      for (const key of ["schemaVersion", "boardId", "title"] as const) {
        if (board.get(key) !== b[key]) board.set(key, b[key]);
      }
      let pages = board.get("pageMap") as Y.Map<Y.Map<unknown>> | undefined;
      if (!pages) { pages = new Y.Map(); board.set("pageMap", pages); }
      const livePages = new Set(b.pages.map(p => p.id));
      for (const id of pages.keys()) if (!livePages.has(id)) pages.delete(id);
      const stored = new Map([...pages].map(([id, entry]) => [id, entry.get("order") as string]));
      const desired = new Map(stored);
      for (const [id, key] of pageOrders ?? []) if (livePages.has(id)) desired.set(id, key);
      const writes = orderWrites(b.pages.map(p => p.id), desired, movedPages);
      for (const [id, key] of pageOrders ?? []) if (livePages.has(id)) writes.set(id, key);
      for (const page of b.pages) {
        let entry = pages.get(page.id);
        if (!entry) { entry = new Y.Map(); pages.set(page.id, entry); }
        if (entry.get("name") !== page.name) entry.set("name", page.name);
        if (writes.has(page.id) && entry.get("order") !== writes.get(page.id)) entry.set("order", writes.get(page.id));
      }
      const objects = this.doc.getMap<Y.Map<unknown>>("objects");
      const live = new Set(b.objects.map((o) => o.id));
      for (const id of objects.keys()) if (!live.has(id)) objects.delete(id);
      for (const o of b.objects) {
        let m = objects.get(o.id);
        if (!m) {
          m = new Y.Map<unknown>();
          objects.set(o.id, m);
        }
        for (const key of ["generation", "type", "page", "order", "group", "section"] as const) {
          if (m.get(key) !== o[key]) m.set(key, o[key]);
        }
        for (const [key, value] of Object.entries(hasEnds(o) ? { ends: { from: { object: o.from.object, anchor: o.from.anchor }, to: { object: o.to.object, anchor: o.to.anchor } }, connectorStyle: connectorStyleOf(o) } : extraValues(o))) {
          if (JSON.stringify(m.get(key)) !== JSON.stringify(value)) m.set(key, value);
        }
        if (isImage(o)) for (const key of ["text", "style", "marks", "ends", "connectorStyle"]) m.delete(key);
        else for (const key of ["asset", "pixelWidth", "pixelHeight", "description"]) m.delete(key);
        if (hasText(o)) {
          let text = m.get("text") as Y.Text | undefined;
          if (!text) {
            text = new Y.Text();
            m.set("text", text);
          }
          if (text.toString() !== o.text) {
            const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
            const old = [...segmenter.segment(text.toString())].map((part) => part.segment);
            const next = [...segmenter.segment(o.text)].map((part) => part.segment);
            let start = 0, end = 0;
            while (start < old.length && start < next.length && old[start] === next[start]) start++;
            while (end < old.length - start && end < next.length - start &&
              old[old.length - 1 - end] === next[next.length - 1 - end]) end++;
            const offset = old.slice(0, start).join("").length;
            const removed = old.slice(start, old.length - end).join("").length;
            if (removed) text.delete(offset, removed);
            const inserted = next.slice(start, next.length - end).join("");
            if (inserted) text.insert(offset, inserted);
          }
          const style = styleOf(o);
          if (JSON.stringify(m.get("style")) !== JSON.stringify(style)) {
            m.set("style", style);
          }
          const marks = o.marks.map(markOf);
          if (JSON.stringify(m.get("marks")) !== JSON.stringify(marks)) {
            m.set("marks", marks);
          }
        }
        if (hasRectangle(o)) {
          const geometry = { x: o.x, y: o.y, width: o.width, height: o.height };
          if (JSON.stringify(m.get("geometry")) !== JSON.stringify(geometry)) m.set("geometry", geometry);
        }
      }
      const retired = this.doc.getMap("retired");
      for (const id of retired.keys()) {
        if (!b.retiredGenerations.includes(id)) retired.delete(id);
      }
      for (const id of b.retiredGenerations) {
        if (!retired.has(id)) retired.set(id, true);
      }
    });
  }
  destroy() {
    this.doc.destroy();
  }
}

// Only stored-room and storage-7 backup conversion use the legacy reading.
export function convertPages(doc: Y.Doc, pages: { id: string; name: string }[]) {
  doc.transact(() => {
    const board = doc.getMap("board"), pageMap = new Y.Map<Y.Map<unknown>>(), keys = rebalance(pages.map(p => p.id));
    for (const page of pages) pageMap.set(page.id, new Y.Map<unknown>([["name", page.name], ["order", keys.get(page.id)!]]));
    board.set("pageMap", pageMap); board.delete("pages");
  });
}
