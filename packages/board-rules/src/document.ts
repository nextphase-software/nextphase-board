// SPDX-License-Identifier: Apache-2.0
import { validMarks, type Mark } from "./marks.ts";
import { linkAddress } from "./text-link.ts";
import { OBJECT_TYPES, objectType, extraValues, objectKeys, hasEnds, hasRectangle, eligibleIdea, rectangleType, type ImageKeys, type VideoKeys, type LinkKeys, isVideo, pictureOf, type RectangleType, type TextRectangleType, type PointsType, type StrokeKeys, hasText, type EndsType, type EndsKeys, type Rectangle, type ShapeKeys, type ConnectorStyle, defaultConnectorStyle, connectorStyleOf, typeWithEnds, isMindNode, type MindNodeKeys, type TapeKeys, usesShapePaint, validShape, isTable, table, createTable, canonicalTable, MAX_BOARD_CELLS, type TableKeys, type PlacementType } from "./objects/registry.ts";
import { ALIGNMENTS, COLORS, TEXT_SIZES, type Style } from "./styles.ts";
export type ItemV1 = {
  id: string;
  generation: string;
  type: TextRectangleType;
  page?: string;
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
export type StrokeItem = { page?: string } & Pick<ItemV5, "id" | "generation" | "group" | "section" | "x" | "y" | "width" | "height" | "order"> & StrokeKeys & Partial<ShapeKeys> & { type: PointsType; text?: never; textSize?: never; align?: never; marks?: never };
export type ItemV8 = ItemV7 | StrokeItem;
export type ItemV9 = RectangleItem | ConnectorItem | StrokeItem;
export type ImageItem = { page?: string } & Pick<ItemV5, "id" | "generation" | "group" | "section" | "x" | "y" | "width" | "height" | "order"> & ImageKeys & {
  type: typeof import("./objects/image.ts").image.type;
  text?: never; color?: never; textSize?: never; align?: never; marks?: never;
  shape?: never; fill?: never; border?: never;
};
export type ItemV10 = ItemV9 | ImageItem;
export type MindNodeItem = ItemV6 & MindNodeKeys & { type: typeof import("./objects/mind-node.ts").mindNode.type };
export type TapeItem = { page?: string } & Pick<ItemV5, "id" | "generation" | "group" | "section" | "x" | "y" | "width" | "height" | "order"> & TapeKeys & {
  type: typeof import("./objects/tape.ts").tape.type;
  text?: never; color?: never; textSize?: never; align?: never; marks?: never; shape?: never; fill?: never; border?: never;
};
type LegacyItemV12 = ItemV10 | MindNodeItem | TapeItem;
export type ItemV13 = LegacyItemV12 & { page: string };
export type TableItem = Pick<ItemV5, "id" | "generation" | "page" | "group" | "section" | "x" | "y" | "order"> & TableKeys & {
  page: string;
  type: typeof table.type;
  text?: never; color?: never; align?: never; marks?: never; shape?: never; fill?: never; border?: never;
};
export type TableItemV14 = Omit<TableItem, "merges">;
export type StoredItemV14 = ItemV13 | TableItemV14;
export type VideoItem = Omit<ImageItem, "type" | "page"> & VideoKeys & { page: string; type: typeof import("./objects/video.ts").video.type };
export type StoredItemV15 = StoredItemV14 | VideoItem;
export type LinkItem = Omit<ImageItem, "type" | "page" | keyof ImageKeys> & LinkKeys & {
  page: string; type: typeof import("./objects/link.ts").link.type;
};
export type StoredItemV16 = StoredItemV15 | LinkItem;
export type ItemV18 = ItemV13 | TableItem | VideoItem | LinkItem;
export type ItemV16 = ItemV18;
export type ItemV15 = ItemV16;
export type ItemV14 = ItemV16;
export type ItemV12 = ItemV16;
export type Page = { id: string; name: string };
export type Item = ItemV1 | ItemV2 | ItemV3 | ItemV4 | ItemV5 | ItemV6 | ItemV7 | ItemV8 | ItemV9 | ImageItem | MindNodeItem | TapeItem | TableItemV14 | TableItem | VideoItem | LinkItem;
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
type LegacyBoardV12 = BoardFields & { schemaVersion: 12; objects: LegacyItemV12[] };
export type BoardV12 = BoardV17;
export type BoardV13 = BoardFields & { schemaVersion: 13; pages: Page[]; objects: ItemV13[] };
export type BoardV18 = BoardFields & { schemaVersion: 18; pages: Page[]; objects: ItemV18[] };
export type BoardV17 = BoardV18;
export type BoardV16 = BoardV17;
export type BoardV15 = BoardV17;
export type BoardV14 = BoardV17;
export type Board = BoardFields & { pages?: Page[]; schemaVersion: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18; objects: Item[] };
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const tableCellCount = (items: readonly Item[]) => items.filter(isTable).reduce((sum, t) => sum + t.rows.length * t.columns.length, 0);
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
      ...(b.schemaVersion >= 13 ? ["pages"] : []),
      "objects",
      "retiredGenerations",
    ]) || ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].includes(b.schemaVersion) || typeof b.boardId !== "string" || !uuid.test(b.boardId) ||
    typeof b.title !== "string" || !validText(b.title, 120, true) ||
    !Array.isArray(b.objects) || b.objects.length > 250 ||
    !Array.isArray(b.retiredGenerations) || b.retiredGenerations.length > 10000
  ) throw Error("Unsupported or malformed board");
  if (b.schemaVersion >= 13 && (!Array.isArray(b.pages) || b.pages.length < 1 || b.pages.length > 50 ||
    new Set(b.pages.map((p) => p?.id)).size !== b.pages.length || b.pages.some((p) => !p ||
      !keys(p, ["id", "name"]) || typeof p.id !== "string" || !uuid.test(p.id) || !validPageName(p.name)))) throw Error("Invalid pages");
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
    if (!(hasEnds(o) ? typeWithEnds().validExtras(o, b.schemaVersion) : usesShapePaint(o) ? validShape(o, b.schemaVersion) : objectType(o.type).validExtras(o))) throw Error("Invalid object paint");
    if (b.schemaVersion >= 2 && hasText(o)) {
      const styled = o as ItemV2;
      if (!COLORS.some((c) => c.name === styled.color) ||
        !TEXT_SIZES.some((s) => s.name === styled.textSize) ||
        !ALIGNMENTS.some((a) => a.name === styled.align)) throw Error("Invalid style");
    }
    if (b.schemaVersion >= 4 && hasText(o)) {
      const { marks } = o as ItemV4;
      if (!validMarks(marks, count(o.text))) throw Error("Invalid marks");
      for (const mark of marks) if (Object.hasOwn(mark, "link")) {
        if (b.schemaVersion < 17 || !objectType(o.type).richText) throw Error("Invalid marks");
        const result = linkAddress(mark.link!);
        if (!result.ok || result.href !== mark.link) throw Error("Invalid marks");
      }
    }
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
  if (b.schemaVersion >= 13) {
    const pages = new Set(b.pages!.map((p) => p.id)), objects = new Map(b.objects.map((o) => [o.id, o]));
    const groups = new Map<string, string>();
    for (const o of b.objects) {
      if (!o.page || !pages.has(o.page) || pages.has(o.id) || pages.has(o.generation) ||
        hasEnds(o) && (objects.get(o.from.object)?.page !== o.page || objects.get(o.to.object)?.page !== o.page) ||
        "section" in o && o.section !== null && objects.get(o.section)?.page !== o.page ||
        isMindNode(o) && o.parent !== null && objects.get(o.parent)?.page !== o.page) throw Error("Invalid page reference");
      if ("group" in o && o.group) {
        if (groups.has(o.group) && groups.get(o.group) !== o.page) throw Error("Group crosses pages");
        groups.set(o.group, o.page);
      }
    }
  }
  if (b.schemaVersion >= 15) {
    const videos = new Set(b.objects.filter(isVideo).map(o => o.asset));
    if (b.objects.some(o => { const picture = pictureOf(o); return picture !== undefined && videos.has(picture); })) {
      throw Error("Asset used as both picture and video");
    }
  }
  if (tableCellCount(b.objects) > MAX_BOARD_CELLS) throw Error("Too many table cells");
  if (b.schemaVersion >= 11 && !validStructure(b.objects)) throw Error("Invalid mind map");
  return b;
}
// The single home of the mind-map structure rule: every parent is another mind
// node in the document, every parent chain reaches a root, only first-level
// nodes have a side and a root is never collapsed.
export function validStructure(objects: readonly { id: string; type: string }[]): boolean {
  const nodes = new Map(objects.filter(isMindNode).map((o) => [o.id, o]));
  if ([...nodes.values()].some((o) => o.parent !== null && (o.parent === o.id || !nodes.has(o.parent)))) return false;
  const reaches = new Map<string, boolean>();
  for (const o of nodes.values()) {
    const chain: string[] = [];
    let current = o;
    while (current.parent !== null && !reaches.has(current.id)) {
      if (chain.includes(current.id)) return false;
      chain.push(current.id);
      current = nodes.get(current.parent)!;
    }
    for (const id of chain) reaches.set(id, true);
    reaches.set(current.id, true);
    const parent = o.parent === null ? undefined : nodes.get(o.parent)!;
    if (!parent ? o.side !== null || o.collapsed : parent.parent === null ? o.side === null : o.side !== null) return false;
  }
  return true;
}
export function validPageName(name: unknown): name is string {
  return typeof name === "string" && validText(name, 60, true) && name === name.trim() && !/[\u0000-\u001f\u007f-\u009f]/u.test(name);
}
// Page metadata is excluded from the inherited payload budget (document v18).
export function payloadBytes(text: string): number {
  const value = JSON.parse(text);
  if (value.schemaVersion === 13 || value.schemaVersion === 14 || value.schemaVersion === 15 || value.schemaVersion === 16 || value.schemaVersion === 17 || value.schemaVersion === 18) {
    delete value.pages;
    for (const object of value.objects) delete object.page;
    return new TextEncoder().encode(JSON.stringify(value)).length;
  }
  return new TextEncoder().encode(text).length;
}
export function canonical(b: Board, options?: { loadTimeUpgrade: true }) {
  validate(b);
  const s = JSON.stringify({
    schemaVersion: b.schemaVersion,
    boardId: b.boardId,
    title: b.title,
    ...(b.schemaVersion >= 13 ? { pages: b.pages!.map(({ id, name }) => ({ id, name })) } : {}),
    objects: b.objects.map((o) => {
      const values: Record<string, unknown> = { ...o, ...extraValues(o), ...(isTable(o) ? canonicalTable(o) : {}),
        ...(hasText(o) && b.schemaVersion >= 4 ? { marks: (o as ItemV4).marks.map(markOf) } : {}) };
      return Object.fromEntries(objectKeys(o.type, b.schemaVersion).map((key) => [key, values[key]]));
    }),
    retiredGenerations: [...b.retiredGenerations],
  });
  if (!options?.loadTimeUpgrade && payloadBytes(s) > 2097152) {
    throw Error("Board too large");
  }
  return s;
}
export function styleOf(o: Style): Style {
  return { color: o.color, textSize: o.textSize, align: o.align };
}
export function markOf(m: Mark): Mark {
  return { start: m.start, end: m.end,
    ...(m.bold ? { bold: true } : {}),
    ...(m.italic ? { italic: true } : {}),
    ...(m.strike ? { strike: true } : {}),
    ...(Object.hasOwn(m, "link") ? { link: m.link } : {}),
  };
}
// Adoption is deliberately separate from decoding/canonicalization: opening
// legacy bytes never rewrites them or advances the editing revision.
function legacyUpgrade(b: Board): LegacyBoardV12 {
  if (b.schemaVersion === 12) return b as LegacyBoardV12;
  if (b.schemaVersion === 11 || b.schemaVersion === 10 || b.schemaVersion === 9) return { ...b, schemaVersion: 12 } as LegacyBoardV12;
  if (b.schemaVersion === 8) return { ...b, schemaVersion: 12, objects: (b.objects as ItemV8[]).map((o) => hasEnds(o) ? { ...o, ...defaultConnectorStyle() } : o) };
  return {
    ...b, schemaVersion: 12,
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
export function upgrade(b: Board): BoardV18 {
  if (b.schemaVersion === 18) return b as BoardV18;
  if (b.schemaVersion >= 13) return {
    ...b, schemaVersion: 18, pages: b.pages!,
    objects: (b.objects as StoredItemV16[]).map((object): ItemV18 => {
      if (object.type !== table.type) return object;
      const { id, generation, type, page, columns, rows, cells, textSize, group, section, x, y, width, height, order } = object;
      return { id, generation, type, page, columns, rows, cells, merges: [], textSize, group, section, x, y, width, height, order };
    }),
  };
  const older = legacyUpgrade(b);
  return { ...older, schemaVersion: 18, pages: [{ id: b.boardId, name: "Page 1" }],
    objects: older.objects.map((o) => ({ ...o, page: b.boardId })) };
}
export function empty(): BoardV18 {
  const boardId = crypto.randomUUID();
  return { schemaVersion: 18, boardId, title: "", pages: [{ id: boardId, name: "Page 1" }], objects: [], retiredGenerations: [] };
}
// Every identifier namespace shares one freshness rule, including IDs allocated
// earlier in a multi-object command.
export function freshIdentifier(board: Board, extra: readonly string[] = []): string {
  const used = new Set([
    board.boardId, ...(board.pages ?? []).map((p) => p.id), ...board.retiredGenerations, ...extra,
    ...board.objects.flatMap((o) => [o.id, o.generation, ...("group" in o && o.group ? [o.group] : [])]),
  ]);
  let id: string;
  do id = crypto.randomUUID(); while (used.has(id));
  return id;
}
export function add(input: Board, type: PlacementType, x: number, y: number, page = input.boardId, dimensions?: { columns: number; rows: number }): BoardV18 {
  const b = upgrade(input);
  if (b.objects.length >= 250) throw Error("250 object limit reached");
  const record = objectType(type);
  const id = freshIdentifier(b);
  if (!record.text) {
    const keys = createTable(dimensions?.columns, dimensions?.rows);
    return { ...b, objects: [...b.objects, {
      id, generation: freshIdentifier(b, [id]), type: record.type, page, ...keys, group: null, section: null,
      x: clamp(Math.round(x), -1e6, 1e6 - keys.width), y: clamp(Math.round(y), -1e6, 1e6 - keys.height), order: b.objects.length,
    }] };
  }
  const { width, height } = record.defaultSize;
  return {
    ...b,
    objects: [...b.objects, {
      id,
      generation: freshIdentifier(b, [id]),
      type: record.type,
      page,
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
