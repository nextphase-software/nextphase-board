// SPDX-License-Identifier: Apache-2.0
import * as Y from "yjs";
import { markOf, styleOf, upgrade, type Board } from "nextphase-board-rules/document.ts";
import { connectorStyleOf, extraValues, hasEnds, hasRectangle, hasText, isImage } from "nextphase-board-rules/objects/registry.ts";
export class Adapter {
  doc = new Y.Doc();
  set(input: Board) {
    const b = upgrade(input);
    this.doc.transact(() => {
      const board = this.doc.getMap("board");
      for (const key of ["schemaVersion", "boardId", "title"] as const) {
        if (board.get(key) !== b[key]) board.set(key, b[key]);
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
        for (const key of ["generation", "type", "order", "group", "section"] as const) {
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
