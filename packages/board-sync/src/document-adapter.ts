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
      board.set("schemaVersion", b.schemaVersion);
      board.set("boardId", b.boardId);
      board.set("title", b.title);
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
            text.delete(0, text.length);
            text.insert(0, o.text);
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
