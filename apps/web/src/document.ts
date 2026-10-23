// SPDX-License-Identifier: Apache-2.0
import * as Y from "yjs";
export type Item = {
  id: string;
  generation: string;
  type: "sticky" | "text";
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  order: number;
};
export type Board = {
  schemaVersion: 1;
  boardId: string;
  title: string;
  objects: Item[];
  retiredGenerations: string[];
};
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const count = (s: string) => Array.from(s).length;
export function validText(s: string, max: number, required = false) {
  return !/[\uD800-\uDFFF]/u.test(s) && count(s) <= max &&
    (!required || /\S/u.test(s));
}
function keys(x: object, names: string[]) {
  return Object.keys(x).sort().join("|") === names.sort().join("|");
}
export function validate(value: unknown): Board {
  const b = value as Board;
  if (
    !b || typeof b !== "object" ||
    !keys(b, [
      "schemaVersion",
      "boardId",
      "title",
      "objects",
      "retiredGenerations",
    ]) || b.schemaVersion !== 1 || typeof b.boardId !== "string" || !uuid.test(b.boardId) ||
    typeof b.title !== "string" || !validText(b.title, 120, true) ||
    !Array.isArray(b.objects) || b.objects.length > 250 ||
    !Array.isArray(b.retiredGenerations) || b.retiredGenerations.length > 10000
  ) throw Error("Unsupported or malformed board");
  const ids = new Set([b.boardId]);
  const gens = new Set<string>();
  for (const [i, o] of b.objects.entries()) {
    if (
      !o ||
      !keys(o, [
        "id",
        "generation",
        "type",
        "text",
        "x",
        "y",
        "width",
        "height",
        "order",
      ]) || typeof o.id !== "string" || typeof o.generation !== "string" ||
      !uuid.test(o.id) || !uuid.test(o.generation) || ids.has(o.id) ||
      ids.has(o.generation) || gens.has(o.id) || gens.has(o.generation) ||
      o.id === o.generation || !["sticky", "text"].includes(o.type) ||
      typeof o.text !== "string" || !validText(o.text, 1000) || o.order !== i ||
      ![o.x, o.y, o.width, o.height].every(Number.isFinite) || o.x < -1e6 ||
      o.y < -1e6 || o.width < 40 || o.width > 2000 || o.height < 40 ||
      o.height > 2000 || o.x + o.width > 1e6 || o.y + o.height > 1e6
    ) throw Error("Invalid object");
    ids.add(o.id);
    gens.add(o.generation);
  }
  if (
    new Set(b.retiredGenerations).size !== b.retiredGenerations.length ||
    b.retiredGenerations.some((g, i, a) =>
      typeof g !== "string" || !uuid.test(g) || gens.has(g) || (i > 0 && a[i - 1] > g)
    )
  ) throw Error("Invalid generations");
  return b;
}
export function canonical(b: Board) {
  validate(b);
  const s = JSON.stringify({
    schemaVersion: 1,
    boardId: b.boardId,
    title: b.title,
    objects: b.objects.map((o) => ({
      id: o.id,
      generation: o.generation,
      type: o.type,
      text: o.text,
      x: o.x,
      y: o.y,
      width: o.width,
      height: o.height,
      order: o.order,
    })),
    retiredGenerations: [...b.retiredGenerations],
  });
  if (new TextEncoder().encode(s).length > 2097152) {
    throw Error("Board too large");
  }
  return s;
}
export function empty(): Board {
  return {
    schemaVersion: 1,
    boardId: crypto.randomUUID(),
    title: "",
    objects: [],
    retiredGenerations: [],
  };
}
export function add(b: Board, type: Item["type"], x: number, y: number): Board {
  if (b.objects.length >= 250) throw Error("250 object limit reached");
  const width = type === "sticky" ? 240 : 320,
    height = type === "sticky" ? 240 : 120;
  return {
    ...b,
    objects: [...b.objects, {
      id: crypto.randomUUID(),
      generation: crypto.randomUUID(),
      type,
      text: "",
      x: clamp(x - width / 2, -1e6, 1e6 - width),
      y: clamp(y - height / 2, -1e6, 1e6 - height),
      width,
      height,
      order: b.objects.length,
    }],
  };
}
export const clamp = (n: number, a: number, b: number) =>
  Math.max(a, Math.min(b, n));
export class Adapter {
  doc = new Y.Doc();
  set(b: Board) {
    this.doc.transact(() => {
      const board = this.doc.getMap("board");
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
        for (const key of ["generation", "type", "order"] as const) {
          if (m.get(key) !== o[key]) m.set(key, o[key]);
        }
        let text = m.get("text") as Y.Text | undefined;
        if (!text) {
          text = new Y.Text();
          m.set("text", text);
        }
        if (text.toString() !== o.text) {
          text.delete(0, text.length);
          text.insert(0, o.text);
        }
        const geometry = { x: o.x, y: o.y, width: o.width, height: o.height };
        if (JSON.stringify(m.get("geometry")) !== JSON.stringify(geometry)) {
          m.set("geometry", geometry);
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
