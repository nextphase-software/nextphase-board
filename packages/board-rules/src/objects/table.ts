// SPDX-License-Identifier: Apache-2.0
import { TEXT_SIZES, type Style } from "../styles.ts";

export const MAX_COLUMNS = 20, MAX_ROWS = 50, MAX_CELL_TEXT = 1000, MAX_BOARD_CELLS = 5000;
export const MIN_TABLE_SIZE = 64, MAX_TABLE_SIZE = 1000, COLUMN_WIDTH = 192, ROW_HEIGHT = 64;
export const TABLE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export type CellAddress = { row: string; column: string };
export type TableMerge = CellAddress & { rows: number; columns: number };
export type CellRange = { from: CellAddress; to: CellAddress };
export type TableBounds = { top: number; left: number; bottom: number; right: number };
export type TableRefusal = "invalid" | "notRun" | "edge" | "merge" | "limit" | "single";
export type TableCell = CellAddress & { text: string };
export type TableColumn = { id: string; width: number };
export type TableRow = { id: string; height: number };
export type TableAxis = "column" | "row";
export type TableKeys = {
  columns: TableColumn[]; rows: TableRow[]; cells: TableCell[]; merges: TableMerge[]; textSize: Style["textSize"];
  width: number; height: number;
};
export const cellKey = ({ row, column }: CellAddress) => row + ":" + column;
export const cellText = (t: TableKeys, at: CellAddress) => t.cells.find(c => c.row === at.row && c.column === at.column)?.text ?? "";
export const validAxisSize = (size: unknown) => Number.isInteger(size) && Number(size) >= MIN_TABLE_SIZE && Number(size) <= MAX_TABLE_SIZE;
export const axisSize = (size: number) => Math.max(MIN_TABLE_SIZE, Math.min(MAX_TABLE_SIZE, Math.round(size)));
export const validCellText = (text: unknown): text is string => typeof text === "string" && !/[\uD800-\uDFFF]/u.test(text) && Array.from(text).length <= MAX_CELL_TEXT;
const exact = (value: unknown, keys: string[]) => value !== null && typeof value === "object" &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

export function validTable(value: unknown): boolean {
  const t = value as TableKeys & { x: number; y: number };
  if (!t || !Number.isInteger(t.x) || !Number.isInteger(t.y) || !TEXT_SIZES.some(s => s.name === t.textSize) ||
      !Array.isArray(t.columns) || t.columns.length < 1 || t.columns.length > MAX_COLUMNS ||
      !Array.isArray(t.rows) || t.rows.length < 1 || t.rows.length > MAX_ROWS || !Array.isArray(t.cells)) return false;
  if (![...t.columns].every(c => exact(c, ["id", "width"]) && typeof c.id === "string" && TABLE_ID.test(c.id) && validAxisSize(c.width)) ||
      ![...t.rows].every(r => exact(r, ["id", "height"]) && typeof r.id === "string" && TABLE_ID.test(r.id) && validAxisSize(r.height))) return false;
  const columns = new Set(t.columns.map(c => c.id)), rows = new Set(t.rows.map(r => r.id));
  if (new Set([...columns, ...rows]).size !== t.columns.length + t.rows.length ||
      t.width !== t.columns.reduce((sum, c) => sum + c.width, 0) || t.height !== t.rows.reduce((sum, r) => sum + r.height, 0)) return false;
  if (!([...t.cells].every(c => exact(c, ["row", "column", "text"]) && rows.has(c.row) && columns.has(c.column) && validCellText(c.text) && c.text.length > 0) &&
    new Set(t.cells.map(cellKey)).size === t.cells.length)) return false;
  if (!Object.hasOwn(t, "merges")) return true;
  if (!Array.isArray(t.merges) || t.merges.length > Math.floor(t.rows.length * t.columns.length / 2)) return false;
  const occupied = new Set<string>();
  const texts = new Set(t.cells.map(cellKey));
  for (const merge of t.merges) {
    if (!exact(merge, ["row", "column", "rows", "columns"]) ||
        !Number.isSafeInteger(merge.rows) || !Number.isSafeInteger(merge.columns) ||
        merge.rows < 1 || merge.columns < 1 || merge.rows * merge.columns < 2) return false;
    const b = mergeBounds(t, merge);
    if (b.top < 0 || b.left < 0 || b.bottom >= t.rows.length || b.right >= t.columns.length) return false;
    for (let row = b.top; row <= b.bottom; row++) {
      for (let column = b.left; column <= b.right; column++) {
        const key = cellKey(cellAt(t, row, column)!);
        if (occupied.has(key) || (row !== b.top || column !== b.left) && texts.has(key)) return false;
        occupied.add(key);
      }
    }
  }
  return true;
}

export function canonicalTable(t: TableKeys): TableKeys {
  const rows = new Map(t.rows.map((row, index) => [row.id, index]));
  const columns = new Map(t.columns.map((column, index) => [column.id, index]));
  return {
    columns: t.columns.map(({ id, width }) => ({ id, width })),
    rows: t.rows.map(({ id, height }) => ({ id, height })),
    cells: t.cells.map(({ row, column, text }) => ({ row, column, text }))
      .sort((a, b) => rows.get(a.row)! - rows.get(b.row)! || columns.get(a.column)! - columns.get(b.column)!),
    merges: (t.merges ?? []).map(({ row, column, rows, columns }) => ({ row, column, rows, columns }))
      .sort((a, b) => rows.get(a.row)! - rows.get(b.row)! || columns.get(a.column)! - columns.get(b.column)!),
    textSize: t.textSize, width: t.width, height: t.height,
  };
}

export function sizeTable<T extends TableKeys>(t: T): T {
  return { ...t, width: t.columns.reduce((sum, c) => sum + c.width, 0), height: t.rows.reduce((sum, r) => sum + r.height, 0) };
}

export function createTable(columns = 2, rows = 2, id: () => string = () => crypto.randomUUID()): TableKeys {
  if (!Number.isInteger(columns) || columns < 1 || columns > MAX_COLUMNS ||
      !Number.isInteger(rows) || rows < 1 || rows > MAX_ROWS) throw Error("Invalid table size");
  return {
    columns: Array.from({ length: columns }, () => ({ id: id(), width: COLUMN_WIDTH })),
    rows: Array.from({ length: rows }, () => ({ id: id(), height: ROW_HEIGHT })),
    cells: [], merges: [], textSize: "medium", width: columns * COLUMN_WIDTH, height: rows * ROW_HEIGHT,
  };
}

function axisEntries(t: TableKeys, axis: TableAxis) {
  return axis === "row" ? t.rows : t.columns;
}

function axisSpan(t: TableKeys, merge: TableMerge, axis: TableAxis) {
  const first = axisEntries(t, axis).findIndex(entry => entry.id === merge[axis]);
  return { first, end: first + (axis === "row" ? merge.rows : merge.columns) };
}

function mergeBounds(t: TableKeys, merge: TableMerge): TableBounds {
  const { row: top, column: left } = cellIndex(t, merge);
  return { top, left, bottom: top + merge.rows - 1, right: left + merge.columns - 1 };
}

function contains(b: TableBounds, row: number, column: number) {
  return b.top <= row && row <= b.bottom && b.left <= column && column <= b.right;
}

export function mergeOf(t: TableKeys, cell: CellAddress): TableMerge | undefined {
  const { row, column } = cellIndex(t, cell);
  if (row < 0 || column < 0) return;
  return (t.merges ?? []).find(merge => contains(mergeBounds(t, merge), row, column));
}

export function rangeBounds(t: TableKeys, range: CellRange): TableBounds | undefined {
  const from = cellIndex(t, range.from), to = cellIndex(t, range.to);
  if (Math.min(from.row, from.column, to.row, to.column) < 0) return;
  const b = { top: Math.min(from.row, to.row), left: Math.min(from.column, to.column),
    bottom: Math.max(from.row, to.row), right: Math.max(from.column, to.column) };
  const spans = (t.merges ?? []).map(merge => mergeBounds(t, merge));
  let grown: boolean;
  do {
    grown = false;
    for (const span of spans) {
      if (span.top > b.bottom || span.bottom < b.top || span.left > b.right || span.right < b.left ||
          contains(b, span.top, span.left) && contains(b, span.bottom, span.right)) continue;
      b.top = Math.min(b.top, span.top);
      b.left = Math.min(b.left, span.left);
      b.bottom = Math.max(b.bottom, span.bottom);
      b.right = Math.max(b.right, span.right);
      grown = true;
    }
  } while (grown);
  return b;
}

export function canMerge(t: TableKeys, range: CellRange): TableRefusal | null {
  const b = rangeBounds(t, range);
  if (!b) return "invalid";
  const rows = b.bottom - b.top + 1, columns = b.right - b.left + 1;
  const anchor = cellAt(t, b.top, b.left)!;
  if (rows * columns === 1 || t.merges.some(merge =>
    cellKey(merge) === cellKey(anchor) && merge.rows === rows && merge.columns === columns)) return "single";
  return null;
}

export function mergeRange<T extends TableKeys>(t: T, range: CellRange): T {
  if (canMerge(t, range)) return t;
  const b = rangeBounds(t, range)!;
  const anchor = cellAt(t, b.top, b.left)!;
  const inside = (cell: CellAddress) => {
    const { row, column } = cellIndex(t, cell);
    return contains(b, row, column);
  };
  const merges = t.merges.filter(merge => !inside(merge));
  merges.push({ ...anchor, rows: b.bottom - b.top + 1, columns: b.right - b.left + 1 });
  return { ...t, merges, cells: t.cells.filter(cell => !inside(cell) || cellKey(cell) === cellKey(anchor)) };
}

export function splitMerge<T extends TableKeys>(t: T, anchor: CellAddress): T {
  const merges = t.merges.filter(merge => cellKey(merge) !== cellKey(anchor));
  return merges.length === t.merges.length ? t : { ...t, merges };
}

function runIndices(t: TableKeys, axis: TableAxis, ids: string[]) {
  const indices = ids.map(id => axisEntries(t, axis).findIndex(entry => entry.id === id));
  if (!indices.length || indices.includes(-1) || new Set(indices).size !== ids.length) return;
  return { first: Math.min(...indices), last: Math.max(...indices) };
}

function cutsMerge(t: TableKeys, axis: TableAxis, first: number, last: number, gap?: number) {
  return t.merges.some(merge => {
    const span = axisSpan(t, merge, axis);
    const partial = first < span.end && span.first <= last && (first > span.first || last + 1 < span.end);
    return partial || gap !== undefined && span.first < gap && gap < span.end;
  });
}

export function canMove(t: TableKeys, axis: TableAxis, ids: string[], toIndex: number): TableRefusal | null {
  const run = runIndices(t, axis, ids);
  if (!run || !Number.isSafeInteger(toIndex)) return "invalid";
  const { first, last } = run;
  if (last - first + 1 !== ids.length) return "notRun";
  if (toIndex < 0 || toIndex > axisEntries(t, axis).length || first <= toIndex && toIndex <= last + 1) return "edge";
  return cutsMerge(t, axis, first, last, toIndex) ? "merge" : null;
}

function moveRun<Entry extends { id: string }>(entries: Entry[], ids: string[], gap: number): Entry[] {
  const moving = new Set(ids);
  const before = entries.slice(0, gap).filter(entry => !moving.has(entry.id));
  const after = entries.slice(gap).filter(entry => !moving.has(entry.id));
  return [...before, ...entries.filter(entry => moving.has(entry.id)), ...after];
}

export function moveAxis<T extends TableKeys>(t: T, axis: TableAxis, ids: string[], toIndex: number): T {
  if (canMove(t, axis, ids, toIndex)) return t;
  return axis === "row" ? { ...t, rows: moveRun(t.rows, ids, toIndex) } : { ...t, columns: moveRun(t.columns, ids, toIndex) };
}

export function canDuplicate(t: TableKeys, axis: TableAxis, ids: string[]): TableRefusal | null {
  const run = runIndices(t, axis, ids);
  if (!run) return "invalid";
  if (axisEntries(t, axis).length + ids.length > (axis === "row" ? MAX_ROWS : MAX_COLUMNS)) return "limit";
  if (run.last - run.first + 1 !== ids.length) return "notRun";
  return cutsMerge(t, axis, run.first, run.last) ? "merge" : null;
}

export function duplicateAxis<T extends TableKeys>(t: T, axis: TableAxis, ids: string[], newId: () => string = () => crypto.randomUUID()): T {
  if (canDuplicate(t, axis, ids)) return t;
  const { first, last } = runIndices(t, axis, ids)!;
  const used = new Set([...t.rows, ...t.columns].map(entry => entry.id));
  const copied = new Map<string, string>();
  for (const entry of axisEntries(t, axis).slice(first, last + 1)) {
    const id = newId();
    if (!TABLE_ID.test(id) || used.has(id)) return t;
    copied.set(entry.id, id);
    used.add(id);
  }
  const duplicateEntries = <Entry extends { id: string }>(entries: Entry[]) => [
    ...entries.slice(0, last + 1),
    ...entries.slice(first, last + 1).map(entry => ({ ...entry, id: copied.get(entry.id)! })),
    ...entries.slice(last + 1),
  ];
  const duplicateCells = <Cell extends CellAddress>(cells: Cell[]) => [
    ...cells, ...cells.filter(cell => copied.has(cell[axis])).map(cell => ({ ...cell, [axis]: copied.get(cell[axis])! })),
  ];
  return sizeTable({ ...t, ...(axis === "row" ? { rows: duplicateEntries(t.rows) } : { columns: duplicateEntries(t.columns) }),
    cells: duplicateCells(t.cells), merges: duplicateCells(t.merges) });
}

export function insertAxis<T extends TableKeys>(t: T, axis: TableAxis, id: string,
  at = axisEntries(t, axis).length, size = axis === "row" ? ROW_HEIGHT : COLUMN_WIDTH): T {
  if (!TABLE_ID.test(id) || t.rows.some(r => r.id === id) || t.columns.some(c => c.id === id) ||
      !Number.isFinite(size) || size < MIN_TABLE_SIZE || size > MAX_TABLE_SIZE) return t;
  const n = axisEntries(t, axis).length;
  if (n >= (axis === "row" ? MAX_ROWS : MAX_COLUMNS)) return t;
  const index = Math.trunc(Number(at)) || 0;
  const gap = index < 0 ? Math.max(n + index, 0) : Math.min(index, n);
  const count = axis === "row" ? "rows" : "columns";
  const merges = t.merges.map(merge => {
    const span = axisSpan(t, merge, axis);
    return span.first < gap && gap < span.end ? { ...merge, [count]: merge[count] + 1 } : merge;
  });
  if (axis === "row") {
    const rows = [...t.rows];
    rows.splice(gap, 0, { id, height: axisSize(size) });
    return sizeTable({ ...t, rows, merges });
  }
  const columns = [...t.columns];
  columns.splice(gap, 0, { id, width: axisSize(size) });
  return sizeTable({ ...t, columns, merges });
}

export function deleteAxis<T extends TableKeys>(t: T, axis: TableAxis, id: string): T {
  const entries = axisEntries(t, axis), index = entries.findIndex(entry => entry.id === id);
  if (entries.length === 1 || index < 0) return t;
  const cells = t.cells.filter(cell => cell[axis] !== id);
  const count = axis === "row" ? "rows" : "columns";
  const merges = t.merges.flatMap(merge => {
    const span = axisSpan(t, merge, axis);
    if (index < span.first || index >= span.end) return [merge];
    if (merge[count] === 1) return [];
    const next = { ...merge, [count]: merge[count] - 1 };
    if (span.first === index) next[axis] = entries[index + 1].id;
    return next.rows * next.columns > 1 ? [next] : [];
  });
  return sizeTable(axis === "row" ? { ...t, cells, merges, rows: t.rows.filter(r => r.id !== id) }
    : { ...t, cells, merges, columns: t.columns.filter(c => c.id !== id) });
}

export function resizeAxis<T extends TableKeys>(t: T, axis: TableAxis, id: string, size: number): T {
  return sizeTable(axis === "row" ? { ...t, rows: t.rows.map(r => r.id === id ? { ...r, height: axisSize(size) } : r) }
    : { ...t, columns: t.columns.map(c => c.id === id ? { ...c, width: axisSize(size) } : c) });
}

export function scaleTable<T extends TableKeys>(t: T, scaleX: number, scaleY: number): T {
  return sizeTable({ ...t, columns: t.columns.map(c => ({ ...c, width: axisSize(c.width * scaleX) })),
    rows: t.rows.map(r => ({ ...r, height: axisSize(r.height * scaleY) })) });
}

export function setCell<T extends TableKeys>(t: T, at: CellAddress, text: string): T {
  if (!validCellText(text) || !t.rows.some(r => r.id === at.row) || !t.columns.some(c => c.id === at.column) || cellText(t, at) === text) return t;
  const merge = mergeOf(t, at);
  if (text && merge && cellKey(at) !== cellKey(merge)) return t;
  const cells = t.cells.filter(c => cellKey(c) !== cellKey(at));
  if (text) cells.push({ row: at.row, column: at.column, text });
  return { ...t, cells };
}

export function cellAt(t: TableKeys, row: number, column: number): CellAddress | undefined {
  const r = t.rows[row], c = t.columns[column];
  return r && c ? { row: r.id, column: c.id } : undefined;
}

export function cellIndex(t: TableKeys, at: CellAddress) {
  return { row: t.rows.findIndex(r => r.id === at.row), column: t.columns.findIndex(c => c.id === at.column) };
}

function anchorOf(t: TableKeys, at: CellAddress): CellAddress {
  const merge = mergeOf(t, at);
  return merge ? { row: merge.row, column: merge.column } : at;
}

export function nextCell(t: TableKeys, at: CellAddress, direction: 1 | -1): CellAddress | undefined {
  const { row, column } = cellIndex(t, anchorOf(t, at));
  if (row < 0 || column < 0) return;
  const width = t.columns.length;
  for (let index = row * width + column + direction; index >= 0 && index < width * t.rows.length; index += direction) {
    const candidate = cellAt(t, Math.floor(index / width), index % width)!;
    if (cellKey(candidate) === cellKey(anchorOf(t, candidate))) return candidate;
  }
}

export function neighbourCell(t: TableKeys, at: CellAddress, arrow: string): CellAddress | undefined {
  const merge = mergeOf(t, at);
  const { row, column } = cellIndex(t, merge ?? at);
  if (row < 0 || column < 0) return;
  const candidate = cellAt(t,
    row + (arrow === "ArrowDown" ? merge?.rows ?? 1 : -Number(arrow === "ArrowUp")),
    column + (arrow === "ArrowRight" ? merge?.columns ?? 1 : -Number(arrow === "ArrowLeft")));
  return candidate && anchorOf(t, candidate);
}

export function remapTable<T extends TableKeys>(t: T, id: () => string = () => crypto.randomUUID()): T {
  const rows = new Map(t.rows.map(r => [r.id, id()]));
  const columns = new Map(t.columns.map(c => [c.id, id()]));
  return { ...t, columns: t.columns.map(c => ({ ...c, id: columns.get(c.id)! })),
    rows: t.rows.map(r => ({ ...r, id: rows.get(r.id)! })),
    cells: t.cells.map(c => ({ row: rows.get(c.row)!, column: columns.get(c.column)!, text: c.text })),
    merges: t.merges.map(({ row, column, ...span }) => ({ row: rows.get(row)!, column: columns.get(column)!, ...span })) };
}

export const table = {
  voting: true, type: "table", label: "Table", tool: "Table", validFrom: 14, body: "table-body",
  points: false, text: false, ends: false, container: false, richText: false, kinds: [],
  extraKeys: [] as readonly string[],
  savedKeys: ["id", "generation", "type", "page", "columns", "rows", "cells", "merges", "textSize", "group", "section", "x", "y", "width", "height", "order"],
  validExtras: validTable, sizeRange: { min: 64, max: 50_000, minWidth: 64 }, shapePaint: false, growsWithText: false, draws: false, previewRadius: 12,
  labelPrefix: (_o: object) => "table", contextLabel: (_o: object) => "Table",
} as const;
