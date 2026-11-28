// SPDX-License-Identifier: Apache-2.0
import * as Y from "yjs";
import { compareKeys, validOrderKey } from "./order-keys.ts";
import type { Board, BoardV10, BoardV13, BoardV18, StoredItemV15, ItemV10, MindNodeItem, ItemV13, StoredItemV14, StoredItemV16, TableItem, TableItemV14 } from "nextphase-board-rules/document.ts";
import { linkAddress } from "nextphase-board-rules/text-link.ts";
import { hasEnds, hasRectangle, hasText, objectType, isTable, TABLE_ID, type TableMerge } from "nextphase-board-rules/objects/registry.ts";

import { TEXT_SIZES } from "nextphase-board-rules/styles.ts";

type WithoutPage<T> = T extends unknown ? Omit<T, "page"> : never;
type StoredBoard<V extends number, Items> = Omit<Board, "objects" | "pages" | "schemaVersion"> & { schemaVersion: V; objects: Items[] };
export type DecodedBoard = BoardV10 | StoredBoard<11, WithoutPage<ItemV10 | MindNodeItem>> | StoredBoard<12, WithoutPage<ItemV13>> | BoardV13 |
  (StoredBoard<14, StoredItemV14> & { pages: BoardV18["pages"] }) | (StoredBoard<15, StoredItemV15> & { pages: BoardV18["pages"] }) |
  (StoredBoard<16 | 17, StoredItemV16> & { pages: BoardV18["pages"] }) | BoardV18;

function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || value instanceof Y.AbstractType ||
    Object.keys(value).some((key) => !keys.includes(key))) throw Error("invalid_update");
  return value as Record<string, unknown>;
}

function map(value: unknown, keys: readonly string[]): Y.Map<unknown> {
  if (!(value instanceof Y.Map) || [...value._map.keys()].some((key) => !keys.includes(key))) {
    throw Error("invalid_update");
  }
  return value;
}

const invalid = (): never => { throw Error("invalid_update"); };
const sharedCell = (key: string) => {
  const [row, column, extra] = key.split(":");
  return extra === undefined && TABLE_ID.test(row) && TABLE_ID.test(column) ? { row, column } : undefined;
};
function tableMap(value: unknown, allowed: (key: string) => boolean) {
  if (!(value instanceof Y.Map) || [...value._map.keys()].some(key => !allowed(key))) return invalid();
  return value as Y.Map<unknown>;
}
function axisEntries<K extends "width" | "height">(value: unknown, size: K) {
  return [...tableMap(value, id => TABLE_ID.test(id))].map(([id, value]) => {
    const entry = map(value, ["order", size]), order = entry.get("order"), units = entry.get(size);
    if (entry.size !== 2 || !validOrderKey(order) || typeof units !== "number" || !Number.isInteger(units)) return invalid();
    return { id, order, units };
  }).sort((a, b) => compareKeys(a.order, b.order) || compareKeys(a.id, b.id));
}
function readTable(value: Y.Map<unknown>, id: string, common: string[], version: number): TableItem | TableItemV14 {
  const keys = [...common, "place", "tableStyle", "columnMap", "rowMap", "cells", ...(version >= 18 ? ["mergeMap"] : [])];
  const table = map(value, keys);
  if (table.size !== keys.length) return invalid();
  const place = exact(table.get("place"), ["x", "y"]), style = exact(table.get("tableStyle"), ["textSize"]);
  if (Object.getPrototypeOf(place) !== Object.prototype || Object.getPrototypeOf(style) !== Object.prototype ||
      Object.keys(place).length !== 2 || !Number.isInteger(place.x) || !Number.isInteger(place.y) ||
      !TEXT_SIZES.some(s => s.name === style.textSize)) return invalid();
  const columns = axisEntries(table.get("columnMap"), "width").map(({id, units}) => ({id, width: units}));
  const rows = axisEntries(table.get("rowMap"), "height").map(({id, units}) => ({id, height: units}));
  const cells = new Map<string, string>();
  for (const [key, text] of tableMap(table.get("cells"), key => !!sharedCell(key))) {
    if (!(text instanceof Y.Text) || text.toDelta().some((part: { attributes?: unknown; insert?: unknown }) =>
      part.attributes || typeof part.insert !== "string")) return invalid();
    const content = text.toString();
    if (content) cells.set(key, content);
  }
  const merges: TableMerge[] = [];
  if (version >= 18) {
    const rowOrder = new Map(rows.map((row, i) => [row.id, i]));
    const columnOrder = new Map(columns.map((column, i) => [column.id, i]));
    for (const [key, value] of tableMap(table.get("mergeMap"), key => !!sharedCell(key))) {
      const { rows, columns } = exact(value, ["rows", "columns"]);
      if (Object.getPrototypeOf(value) !== Object.prototype || !Number.isInteger(rows) || !Number.isInteger(columns)) return invalid();
      merges.push({ ...sharedCell(key)!, rows: rows as number, columns: columns as number });
    }
    const live = (merge: TableMerge) => rowOrder.has(merge.row) && columnOrder.has(merge.column);
    merges.sort((a, b) => !live(a) || !live(b)
      ? Number(live(b)) - Number(live(a)) || compareKeys(a.row + ":" + a.column, b.row + ":" + b.column)
      : rowOrder.get(a.row)! - rowOrder.get(b.row)! || columnOrder.get(a.column)! - columnOrder.get(b.column)!);
  }
  return { id, ...Object.fromEntries(common.map(key => [key, table.get(key)])), ...place, ...style, columns, rows,
    cells: rows.flatMap(({id: row}) => columns.flatMap(({id: column}) => {
      const text = cells.get(row + ":" + column);
      return text ? [{ row, column, text }] : [];
    })),
    ...(version >= 18 ? { merges } : {}),
    width: columns.reduce((sum, c) => sum + c.width, 0), height: rows.reduce((sum, r) => sum + r.height, 0),
  } as TableItem | TableItemV14;
}

// Check the complete mapping before projecting it. Silently discarding an
// unknown field here would allow hidden data to live in an otherwise valid board.
export function readBoard(doc: Y.Doc, legacy = false): DecodedBoard {
  if ([...doc.share.keys()].some((key) => !["board", "objects", "retired"].includes(key))) {
    throw Error("invalid_update");
  }
  const board = map(doc.getMap("board"), ["schemaVersion", "boardId", "title", "pageMap", "pages"]);
  const version = board.get("schemaVersion");
  if (typeof version !== "number" || ![10, 11, 12, 13, 14, 15, 16, 17, 18].includes(version)) return invalid();
  const paged = version >= 13;
  if (!paged && (board.has("pages") || board.has("pageMap"))) return invalid();
  if (!legacy && board.has("pages") || legacy && (version > 13 ||
      version === 13 && (!board.has("pages") || board.has("pageMap")))) throw Error("invalid_update");
  let pages: BoardV18["pages"] | undefined;
  if (paged) {
    if (legacy && board.has("pages")) pages = board.get("pages") as BoardV18["pages"];
    else {
      const pageMap = board.get("pageMap");
      if (!(pageMap instanceof Y.Map) || [...pageMap._map.keys()].some(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id))) throw Error("invalid_update");
      pages = [...pageMap.entries()].map(([id, value]) => {
        const entry = map(value, ["name", "order"]);
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) || entry.size !== 2 ||
          typeof entry.get("name") !== "string" || !validOrderKey(entry.get("order"))) throw Error("invalid_update");
        return { id, name: entry.get("name") as string, order: entry.get("order") as string };
      }).sort((a, b) => compareKeys(a.order, b.order) || compareKeys(a.id, b.id)).map(({ id, name }) => ({ id, name }));
    }
  }
  const objects = doc.getMap("objects");
  const retired = doc.getMap("retired");
  if ([...retired.values()].some((value) => value !== true)) throw Error("invalid_update");
  const items = [...objects.entries()].map(([id, value]) => {
    if (!(value instanceof Y.Map) || typeof value.get("type") !== "string") throw Error("invalid_update");
    const type = value.get("type") as StoredItemV16["type"];
    let record;
    try { record = objectType(type); } catch { throw Error("invalid_update"); }
    const object = { type };
    const common = ["generation", "type", "order", "group", "section", ...(paged ? ["page"] : [])];
    if (isTable(object)) return readTable(value, id, common, version);
    const keys = [...common, ...record.extraKeys];
    if (hasEnds(object)) {
      // The adapter groups ends and connector style into atomic values.
      keys.splice(paged ? 6 : 5);
      keys.push("ends", "connectorStyle");
    }
    if (hasRectangle(object)) keys.push("geometry");
    if (hasText(object)) keys.push("text", "style", "marks");
    const mapped = map(value, keys);
    const result: Record<string, unknown> = { id };
    for (const key of ["generation", "type", "order", "group", "section", ...(paged ? ["page"] : [])]) result[key] = mapped.get(key);
    if (hasEnds(object)) {
      const ends = exact(mapped.get("ends"), ["from", "to"]);
      result.from = exact(ends.from, ["object", "anchor"]);
      result.to = exact(ends.to, ["object", "anchor"]);
      Object.assign(result, exact(mapped.get("connectorStyle"), record.extraKeys.filter((key) => !["from", "to"].includes(key))));
    } else for (const key of record.extraKeys) result[key] = mapped.get(key);
    if (hasRectangle(object)) Object.assign(result, exact(mapped.get("geometry"), ["x", "y", "width", "height"]));
    if (hasText(object)) {
      const text = mapped.get("text");
      if (!(text instanceof Y.Text) || text.toDelta().some((part: { attributes?: unknown; insert?: unknown }) => part.attributes || typeof part.insert !== "string")) {
        throw Error("invalid_update");
      }
      result.text = text.toString();
      Object.assign(result, exact(mapped.get("style"), ["color", "textSize", "align"]));
      const marks = mapped.get("marks");
      if (!Array.isArray(marks)) throw Error("invalid_update");
      result.marks = marks.map((mark) => {
        const entry = exact(mark, ["start", "end", "bold", "italic", "strike", "link"]);
        if (version >= 17 && Object.hasOwn(entry, "link")) {
          const link = entry.link;
          if (typeof link !== "string") return invalid();
          const address = linkAddress(link);
          if (!address.ok || address.href !== link) return invalid();
        }
        return entry;
      });
    }
    for (const key of ["fill", "border"] as const) {
      if (key in result) exact(result[key], key === "fill" ? ["mode", "color"] : ["style", "color"]);
    }
    return result as StoredItemV16;
  });
  return {
    schemaVersion: version,
    boardId: board.get("boardId") as string,
    title: board.get("title") as string,
    ...(paged ? { pages } : {}),
    objects: items.sort((a, b) => a.order - b.order),
    retiredGenerations: [...retired.keys()].sort(),
  } as DecodedBoard;
}

export function readLiveBoard(doc: Y.Doc): BoardV18 {
  const board = readBoard(doc);
  if (board.schemaVersion !== 18) return invalid();
  return board;
}
