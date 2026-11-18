// SPDX-License-Identifier: Apache-2.0
import type { TableItem } from "nextphase-board-rules/document.ts";
import { cellAt, cellIndex, cellText, COLUMN_WIDTH, ROW_HEIGHT, MAX_COLUMNS, MAX_ROWS, MAX_TABLE_SIZE,
  sizeTable, neighbourCell, nextCell, type CellAddress, type TableAxis, type TableKeys } from "nextphase-board-rules/objects/registry.ts";
import { textUnits } from "nextphase-board-rules/styles.ts";
import type { Rectangle, Corner } from "./resize.ts";
import type { Point } from "./selection.ts";

export const TABLE_LEVEL = "table";
export type TableSelection = ({ kind: "table"; id: string } |
  ({ kind: "cell"; id: string } & CellAddress) | { kind: "row"; id: string; row: string } |
  { kind: "column"; id: string; column: string });
export type CellSelection = Extract<TableSelection, { kind: "cell" }>;
export type TableLayout = { box: Rectangle; rows: number[]; minimums: number[] };
export type TableBorder = { axis: TableAxis; index: number; id: string; edge: number };
export type TableGhost = { x: number; y: number; width: number; height: number; columns: number; rows: number };
export type TableAction = { axis: TableAxis; at: "before" | "after" | "end" | "delete" } | { at: "clear" };
export const TABLE_LIMIT_WORDS = "A cell holds up to 1,000 characters.";
export const TABLE_INSET = 20;
export const cellLineHeight = (size: number) => Math.round(size * 1.35);
export type MeasureCell = (text: string, width: number, size: number) => number;

export function layoutTable(t: TableItem, measure: MeasureCell, draft?: { cell: CellAddress; text: string }): TableLayout {
  const size = textUnits(t.textSize), line = cellLineHeight(size);
  const widths = new Map(t.columns.map(c => [c.id, c.width]));
  const heights = new Map(t.rows.map(r => [r.id, line]));
  const cells = draft ? [...t.cells.filter(c => c.row !== draft.cell.row || c.column !== draft.cell.column),
    { ...draft.cell, text: draft.text }] : t.cells;
  for (const cell of cells) {
    const width = widths.get(cell.column), height = heights.get(cell.row);
    if (width !== undefined && height !== undefined) heights.set(cell.row, Math.max(height,
      line * Math.max(1, measure(cell.text, width - 2 * TABLE_INSET, size))));
  }
  const minimums = t.rows.map(r => heights.get(r.id)! + 2 * TABLE_INSET);
  const rows = t.rows.map((r, i) => Math.max(r.height, minimums[i]));
  return { rows, minimums, box: { x: t.x, y: t.y, width: t.width, height: rows.reduce((a, b) => a + b, 0) } };
}
export function growTable(t: TableItem, measure: MeasureCell) {
  const layout = layoutTable(t, measure);
  const rows = t.rows.map((r, i) => ({ ...r, height: Math.min(MAX_TABLE_SIZE, layout.rows[i]) }));
  return boundTable(sizeTable({ ...t, rows }));
}
export function boundTable(t: TableItem, height = t.height): TableItem {
  return { ...t, x: Math.max(-1e6, Math.min(1e6 - t.width, Math.round(t.x))),
    y: Math.max(-1e6, Math.min(1e6 - height, Math.round(t.y))) };
}
export function anchorCell(t: TableKeys, s: TableSelection): CellAddress {
  return { row: "row" in s ? s.row : t.rows[0].id, column: "column" in s ? s.column : t.columns[0].id };
}
const prefix = (numbers: number[], i: number) => numbers.slice(0, i).reduce((a, b) => a + b, 0);
export function cellBox(t: TableKeys, layout: TableLayout, cell: CellAddress): Rectangle | undefined {
  const { row, column } = cellIndex(t, cell);
  if (row < 0 || column < 0) return;
  return { x: layout.box.x + prefix(t.columns.map(c => c.width), column), y: layout.box.y + prefix(layout.rows, row),
    width: t.columns[column].width, height: layout.rows[row] };
}
export function selectionBox(t: TableKeys, layout: TableLayout, selection: TableSelection) {
  const cell = cellBox(t, layout, anchorCell(t, selection));
  if (!cell || selection.kind === TABLE_LEVEL) return layout.box;
  if (selection.kind === "row") return { ...cell, x: layout.box.x, width: layout.box.width };
  if (selection.kind === "column") return { ...cell, y: layout.box.y, height: layout.box.height };
  return cell;
}
export function hitCell(t: TableKeys, layout: TableLayout, p: Point) {
  const { box, rows } = layout;
  const find = (value: number, sizes: number[]) => value < 0 ? -1 :
    sizes.findIndex((_, i) => value < prefix(sizes, i + 1) || i === sizes.length - 1 && value === prefix(sizes, i + 1));
  return cellAt(t, find(p.y - box.y, rows), find(p.x - box.x, t.columns.map(c => c.width)));
}
export function tableBorders(t: TableKeys, layout: TableLayout): TableBorder[] {
  return [
    ...t.columns.map((c, index) => ({ axis: "column" as const, id: c.id, index, edge: layout.box.x + prefix(t.columns.map(c => c.width), index + 1) })),
    ...t.rows.map((r, index) => ({ axis: "row" as const, id: r.id, index, edge: layout.box.y + prefix(layout.rows, index + 1) })),
  ];
}
export function hitBorder(t: TableKeys, layout: TableLayout, p: Point, zoom = 1) {
  const { box } = layout;
  const distance = (b: TableBorder) => Math.abs((b.axis === "row" ? p.y : p.x) - b.edge) * zoom;
  return tableBorders(t, layout).filter(b => distance(b) <= 4 && (b.axis === "row"
    ? p.x >= box.x && p.x <= box.x + box.width : p.y >= box.y && p.y <= box.y + box.height))
    .sort((a, b) => distance(a) - distance(b))[0];
}
export function tableButtons(t: TableKeys, layout: TableLayout, selection: TableSelection, zoom: number) {
  const cell = anchorCell(t, selection), b = cellBox(t, layout, cell);
  if (!b) return [];
  const { box } = layout, at = cellIndex(t, cell), gap = 8 / zoom, grab = 14 / zoom, hit = 28 / zoom, thick = 24 / zoom;
  const button = (axis: TableAxis, action: "select" | "add", rect: Rectangle) => ({
    ...rect, axis, action, index: at[axis], id: cell[axis], selected: selection.kind === axis,
  });
  return [
    ...(selection.kind === "cell" || selection.kind === "column" ? [button("column", "select", {
      x: b.x + b.width / 2 - grab, y: box.y - grab * 2, width: hit, height: hit })] : []),
    ...(selection.kind === "cell" || selection.kind === "row" ? [button("row", "select", {
      x: box.x - grab * 2, y: b.y + b.height / 2 - grab, width: hit, height: hit })] : []),
    ...(selection.kind === TABLE_LEVEL || at.column === t.columns.length - 1 ? [button("column", "add", {
      x: box.x + box.width + gap, y: box.y, width: thick, height: box.height })] : []),
    ...(selection.kind === TABLE_LEVEL || at.row === t.rows.length - 1 ? [button("row", "add", {
      x: box.x, y: box.y + box.height + gap, width: box.width, height: thick })] : []),
  ];
}
export function hitTableButton(t: TableKeys, layout: TableLayout, selection: TableSelection, p: Point, zoom = 1) {
  return tableButtons(t, layout, selection, zoom).find(b => p.x >= b.x && p.y >= b.y &&
    p.x <= b.x + b.width && p.y <= b.y + b.height);
}

export function tableGhost(start: Point, end: Point, drag: boolean): TableGhost {
  const dx = end.x - start.x, dy = end.y - start.y;
  const columns = drag ? Math.max(1, Math.min(MAX_COLUMNS, Math.ceil(Math.abs(dx) / COLUMN_WIDTH))) : 2;
  const rows = drag ? Math.max(1, Math.min(MAX_ROWS, Math.ceil(Math.abs(dy) / ROW_HEIGHT))) : 2;
  const width = columns * COLUMN_WIDTH, height = rows * ROW_HEIGHT;
  return { columns, rows, width, height,
    x: Math.round(Math.max(-1e6, Math.min(1e6 - width, start.x - (drag && dx < 0 ? width : 0)))),
    y: Math.round(Math.max(-1e6, Math.min(1e6 - height, start.y - (drag && dy < 0 ? height : 0)))) };
}
export const tableDimensions = ({ columns, rows }: { columns: { length: number } | number; rows: { length: number } | number }) =>
  `${typeof columns === "number" ? columns : columns.length} × ${typeof rows === "number" ? rows : rows.length}`;
export function validTableSelection(t: TableItem | undefined, s: TableSelection, editing: boolean,
    origin: "own" | "remote" | "reload", label = "Someone") {
  if (!t || t.id !== s.id) return { selection: null, notice: "" };
  const missing = "row" in s && !t.rows.some(r => r.id === s.row) ? "row"
    : "column" in s && !t.columns.some(c => c.id === s.column) ? "column" : undefined;
  if (!missing) return { selection: s, notice: "" };
  return { selection: { kind: "table", id: t.id } as const,
    notice: origin === "remote" ? `${label} deleted a ${missing} you ${editing ? "were editing" : "had selected"}.` : "" };
}
export function tableReason(t: TableKeys, axis: TableAxis, action: "add" | "delete") {
  const count = (axis === "row" ? t.rows : t.columns).length;
  const maximum = axis === "row" ? MAX_ROWS : MAX_COLUMNS;
  if (action === "delete" && count <= 1) return `A table needs at least one ${axis}`;
  if (action === "add" && count >= maximum) return `A table holds at most ${maximum} ${axis}s`;
  return "";
}
export const tableMode = (selection: TableSelection, editing: boolean) => editing ? "Editing" :
  { table: "Table", cell: "Cell", row: "Row", column: "Column" }[selection.kind];
export function cellName(t: TableKeys, cell: CellAddress) {
  const { row, column } = cellIndex(t, cell);
  return `Row ${row + 1}, column ${column + 1}`;
}
export const announceCell = (t: TableKeys, cell: CellAddress) => cellName(t, cell) + ": " + (cellText(t, cell) || "empty");
export const editorName = (t: TableKeys, cell: CellAddress, name: string) => cellName(t, cell) + " of " + name;

type Key = { key: string; code: string; shiftKey: boolean; altKey: boolean; metaKey: boolean; ctrlKey: boolean };
export function tableKey(t: TableKeys, s: TableSelection, e: Key, editing: boolean, readOnly: boolean, composing: boolean):
    { action: TableAction } | { select: CellAddress } | { edit: CellAddress } | { exit: boolean } | { consume: true } | undefined {
  if (readOnly || composing || e.metaKey || e.ctrlKey) return;
  const at = anchorCell(t, s);
  if (editing) {
    if (!e.altKey && e.key === "Tab") {
      const next = nextCell(t, at, e.shiftKey ? -1 : 1);
      return next ? { edit: next } : { exit: false };
    }
    return e.key === "Escape" ? { exit: false } : undefined;
  }
  if (e.altKey) {
    if (s.kind === TABLE_LEVEL) return;
    if (e.code === "Enter") return { action: { axis: "row", at: e.shiftKey ? "before" : "after" } };
    if (!e.shiftKey && (e.code === "BracketLeft" || e.code === "BracketRight"))
      return { action: { axis: "column", at: e.code === "BracketLeft" ? "before" : "after" } };
    return;
  }
  if (e.key === "Escape") return { exit: s.kind === TABLE_LEVEL };
  if (s.kind === TABLE_LEVEL) return e.key === "Enter" ? { select: at } : undefined;
  if (e.key === "Delete" || e.key === "Backspace")
    return { action: s.kind === "cell" ? { at: "clear" } : { axis: s.kind, at: "delete" } };
  if (s.kind === "cell") {
    if (e.key === "Enter") return { edit: at };
    const next = e.key === "Tab" ? nextCell(t, at, e.shiftKey ? -1 : 1) : e.key.startsWith("Arrow") ? neighbourCell(t, at, e.key) : undefined;
    if (next) return { select: next };
  }
  if (e.key === "Tab" || e.key === "Enter" || e.key.startsWith("Arrow")) return { consume: true };
}
export function tableCorner(t: TableItem, old: Rectangle, target: Rectangle, corner: Corner, single: boolean, measure: MeasureCell) {
  return boundTable({ ...t,
    x: single && corner.endsWith("w") ? old.x + old.width - t.width : target.x,
    y: single && corner.startsWith("n") ? old.y + old.height - layoutTable(t, measure).box.height : target.y,
  });
}

export type TableDraft = { cell: CellSelection; text: string };
export type TableEntry = {
  draft: TableDraft | null;
  setDraft: (draft: TableDraft | null) => void;
  composition: { current: { base: string; offset: number; changed: boolean } | null };
  endComposition: () => void;
  exitBefore: <T>(action: () => T, finish: () => void) => () => T;
};
export function rebaseComposition(base: string, live: string, offset: number, inserted: string) {
  let start = 0, end = 0;
  while (start < base.length && start < live.length && base[start] === live[start]) start++;
  while (end < base.length - start && end < live.length - start &&
    base[base.length - 1 - end] === live[live.length - 1 - end]) end++;
  const mapped = offset < start ? offset : offset > base.length - end ? offset + live.length - base.length
    : base.length - end === start ? live.length - end : start;
  return { text: live.slice(0, mapped) + inserted + live.slice(mapped), caret: mapped + inserted.length };
}
