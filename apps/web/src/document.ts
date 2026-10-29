// SPDX-License-Identifier: Apache-2.0
import * as Y from "yjs";
import { validMarks, type Mark } from "./marks.ts";
import { OBJECT_TYPES, objectType, extraValues, objectKeys, hasEnds, hasRectangle, eligibleIdea, rectangleType, type ImageKeys, isImage, type RectangleType, type TextRectangleType, type PointsType, type StrokeKeys, hasText, type EndsType, type EndsKeys, type Rectangle, type ShapeKeys, type ConnectorStyle, defaultConnectorStyle, connectorStyleOf, typeWithEnds } from "./objects/registry.ts";
import { ALIGNMENTS, COLORS, TEXT_SIZES, type Style } from "./styles.ts";
export type ItemV1 = {
  id: string;
  generation: string;
  type: TextRectangleType;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  order: number;
};
export type ItemV2 = ItemV1 & Style;
export type ItemV3 = ItemV2 & { group: string | null };
export type ItemV4 = ItemV3 & { marks: Mark[] };
export type ItemV5 = ItemV4 & { section: string | null };
export type ItemV6 = ItemV5 & Partial<ShapeKeys>;
export type RectangleItem = ItemV6;
export type LegacyConnectorItem = Omit<ItemV6, keyof Rectangle | "type"> & EndsKeys & { type: EndsType };
export type ConnectorItem = LegacyConnectorItem & ConnectorStyle;
export type ItemV7 = RectangleItem | LegacyConnectorItem;
export type StrokeItem = Pick<ItemV5, "id" | "generation" | "group" | "section" | "x" | "y" | "width" | "height" | "order"> & StrokeKeys & Partial<ShapeKeys> & { type: PointsType; text?: never; textSize?: never; align?: never; marks?: never };
export type ItemV8 = ItemV7 | StrokeItem;
export type ItemV9 = RectangleItem | ConnectorItem | StrokeItem;
export type ImageItem = Pick<ItemV5, "id" | "generation" | "group" | "section" | "x" | "y" | "width" | "height" | "order"> & ImageKeys & {
  type: typeof import("./objects/image.ts").image.type;
  text?: never; color?: never; textSize?: never; align?: never; marks?: never;
  shape?: never; fill?: never; border?: never;
};
export type ItemV10 = ItemV9 | ImageItem;
export type ResolvedItem = ItemV10 & Rectangle & { displayHeight: number; connectorLayout?: import("./connectors.ts").ConnectorLayout };
export type Item = ItemV1 | ItemV2 | ItemV3 | ItemV4 | ItemV5 | ItemV6 | ItemV7 | ItemV8 | ItemV9 | ImageItem;
type BoardFields = {
  boardId: string;
  title: string;
  retiredGenerations: string[];
};
export type BoardV1 = BoardFields & { schemaVersion: 1; objects: ItemV1[] };
export type BoardV2 = BoardFields & { schemaVersion: 2; objects: ItemV2[] };
export type BoardV3 = BoardFields & { schemaVersion: 3; objects: ItemV3[] };
export type BoardV4 = BoardFields & { schemaVersion: 4; objects: ItemV4[] };
export type BoardV5 = BoardFields & { schemaVersion: 5; objects: ItemV5[] };
export type BoardV6 = BoardFields & { schemaVersion: 6; objects: ItemV6[] };
export type BoardV7 = BoardFields & { schemaVersion: 7; objects: ItemV7[] };
export type BoardV8 = BoardFields & { schemaVersion: 8; objects: ItemV8[] };
export type BoardV9 = BoardFields & { schemaVersion: 9; objects: ItemV9[] };
export type BoardV10 = BoardFields & { schemaVersion: 10; objects: ItemV10[] };
export type Board = BoardFields & { schemaVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10; objects: Item[] };
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
    ]) || ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(b.schemaVersion) || typeof b.boardId !== "string" || !uuid.test(b.boardId) ||
    typeof b.title !== "string" || !validText(b.title, 120, true) ||
    !Array.isArray(b.objects) || b.objects.length > 250 ||
    !Array.isArray(b.retiredGenerations) || b.retiredGenerations.length > 10000
  ) throw Error("Unsupported or malformed board");
  const ids = new Set([b.boardId]);
  const gens = new Set<string>();
  for (const [i, o] of b.objects.entries()) {
    if (
      !o ||
      !keys(o, objectKeys(o.type, b.schemaVersion)) || typeof o.id !== "string" || typeof o.generation !== "string" ||
      !uuid.test(o.id) || !uuid.test(o.generation) || ids.has(o.id) ||
      ids.has(o.generation) || gens.has(o.id) || gens.has(o.generation) ||
      o.id === o.generation || !OBJECT_TYPES.some((t) => t.type === o.type && t.validFrom <= b.schemaVersion) ||
      hasText(o) && (typeof o.text !== "string" || !validText(o.text, objectType(o.type).textLimit)) || o.order !== i ||
      hasRectangle(o) && (![o.x, o.y, o.width, o.height].every(Number.isFinite) || o.x < -1e6 ||
      o.y < -1e6 || o.width < rectangleType(o.type as RectangleType).sizeRange.min || o.width > rectangleType(o.type as RectangleType).sizeRange.max ||
      o.height < rectangleType(o.type as RectangleType).sizeRange.min || o.height > rectangleType(o.type as RectangleType).sizeRange.max || o.x + o.width > 1e6 || o.y + o.height > 1e6)
    ) throw Error("Invalid object");
    if (!(hasEnds(o) ? typeWithEnds().validExtras(o, b.schemaVersion) : objectType(o.type).validExtras(o))) throw Error("Invalid object paint");
    if (b.schemaVersion >= 2 && hasText(o)) {
      const styled = o as ItemV2;
      if (!COLORS.some((c) => c.name === styled.color) ||
        !TEXT_SIZES.some((s) => s.name === styled.textSize) ||
        !ALIGNMENTS.some((a) => a.name === styled.align)) throw Error("Invalid style");
    }
    if (b.schemaVersion >= 4 && hasText(o) && !validMarks((o as ItemV4).marks, count(o.text))) throw Error("Invalid marks");
    ids.add(o.id);
    gens.add(o.generation);
  }
  if (
    new Set(b.retiredGenerations).size !== b.retiredGenerations.length ||
    b.retiredGenerations.some((g, i, a) =>
      typeof g !== "string" || !uuid.test(g) || gens.has(g) || (i > 0 && a[i - 1] > g)
    )
  ) throw Error("Invalid generations");
  if (b.schemaVersion >= 3) {
    const reserved = new Set([...ids, ...gens, ...b.retiredGenerations]);
    for (const o of b.objects as ItemV3[]) {
      if (o.group !== null && (typeof o.group !== "string" || !uuid.test(o.group) || reserved.has(o.group))) {
        throw Error("Invalid group");
      }
    }
  }
  if (b.schemaVersion >= 5) {
    const containers = new Set(b.objects.filter((o) => objectType(o.type).container).map((o) => o.id));
    for (const o of b.objects as ItemV5[]) {
      const type = objectType(o.type);
      if (type.container && (o.group !== null || o.section !== null || o.marks.length ||
        o.textSize !== type.defaultStyle.textSize || o.align !== type.defaultStyle.align) ||
        o.section !== null && (typeof o.section !== "string" || !containers.has(o.section))) {
        throw Error("Invalid section membership or style");
      }
    }
  }
  for (const o of b.objects) {
    if (hasEnds(o) && (o.from.object === o.to.object || [o.from, o.to].some((end) =>
      !b.objects.some((idea) => idea.id === end.object && eligibleIdea(idea))))) throw Error("Invalid connector ends");
  }
  return b;
}
export function canonical(b: Board) {
  validate(b);
  const s = JSON.stringify({
    schemaVersion: b.schemaVersion,
    boardId: b.boardId,
    title: b.title,
    objects: b.objects.map((o) => {
      const values: Record<string, unknown> = { ...o, ...extraValues(o),
        ...(hasText(o) && b.schemaVersion >= 4 ? { marks: (o as ItemV4).marks.map(markOf) } : {}) };
      return Object.fromEntries(objectKeys(o.type, b.schemaVersion).map((key) => [key, values[key]]));
    }),
    retiredGenerations: [...b.retiredGenerations],
  });
  if (new TextEncoder().encode(s).length > 2097152) {
    throw Error("Board too large");
  }
  return s;
}
function styleOf(o: Style): Style {
  return { color: o.color, textSize: o.textSize, align: o.align };
}
function markOf(m: Mark): Mark {
  return { start: m.start, end: m.end,
    ...(m.bold ? { bold: true } : {}),
    ...(m.italic ? { italic: true } : {}),
    ...(m.strike ? { strike: true } : {}),
  };
}
// Adoption is deliberately separate from decoding/canonicalization: opening
// legacy bytes never rewrites them or advances the editing revision.
export function upgrade(b: Board): BoardV10 {
  if (b.schemaVersion === 10) return b as BoardV10;
  if (b.schemaVersion === 9) return { ...b, schemaVersion: 10 } as BoardV10;
  if (b.schemaVersion === 8) return { ...b, schemaVersion: 10, objects: (b.objects as ItemV8[]).map((o) => hasEnds(o) ? { ...o, ...defaultConnectorStyle() } : o) };
  return {
    ...b, schemaVersion: 10,
    objects: (b.objects as ItemV7[]).map((o) => {
      const current = { ...o,
        ...(b.schemaVersion === 1 ? objectType(o.type).legacyStyle : styleOf(o as ItemV2)),
        group: b.schemaVersion >= 3 ? (o as ItemV3).group : null,
        marks: b.schemaVersion >= 4 ? (o as ItemV4).marks : [], section: b.schemaVersion >= 5 ? (o as ItemV5).section : null,
      };
      return hasEnds(current) ? { ...current, ...defaultConnectorStyle() } : current;
    }),
  };
}
export function empty(): BoardV10 {
  return {
    schemaVersion: 10,
    boardId: crypto.randomUUID(),
    title: "",
    objects: [],
    retiredGenerations: [],
  };
}
// Every identifier namespace shares one freshness rule, including IDs allocated
// earlier in a multi-object command.
export function freshIdentifier(board: Board, extra: readonly string[] = []): string {
  const used = new Set([
    board.boardId, ...board.retiredGenerations, ...extra,
    ...board.objects.flatMap((o) => [o.id, o.generation, ...("group" in o && o.group ? [o.group] : [])]),
  ]);
  let id: string;
  do id = crypto.randomUUID(); while (used.has(id));
  return id;
}
export function add(input: Board, type: TextRectangleType, x: number, y: number): BoardV10 {
  const b = upgrade(input);
  if (b.objects.length >= 250) throw Error("250 object limit reached");
  const record = objectType(type);
  const { width, height } = record.defaultSize;
  const id = freshIdentifier(b);
  return {
    ...b,
    objects: [...b.objects, {
      id,
      generation: freshIdentifier(b, [id]),
      type,
      text: record.initialText,
      ...record.defaultStyle,
      group: null,
      marks: [],
      section: null,
      ...record.defaults(),
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
