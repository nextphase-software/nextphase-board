// SPDX-License-Identifier: Apache-2.0
import type { TableItem } from "nextphase-board-rules/document.ts";
import { cellAt, cellIndex, cellText, COLUMN_WIDTH, ROW_HEIGHT, MAX_COLUMNS, MAX_ROWS, MAX_TABLE_SIZE,
  sizeTable, neighbourCell, nextCell, mergeOf, rangeBounds, cellKey, type CellAddress, type TableAxis, type TableBounds, type TableKeys } from "nextphase-board-rules/objects/registry.ts";
import { textUnits } from "nextphase-board-rules/styles.ts";
import type { Rectangle, Corner } from "./resize.ts";
import type { Point } from "./selection.ts";
import { axisSelected, chosenIds, isRun, keepSelection, moveFocus, selectedText, selectionAnchor, selectionCells } from "./table-selection.ts";

export const TABLE_LEVEL = "table";
export type TableSelection = ({ kind: "table"; id: string } |
  ({ kind: "cell"; id: string } & CellAddress) | { kind: "row"; id: string; row: string } |
  { kind: "column"; id: string; column: string } |
  { kind: "range"; id: string; anchor: CellAddress; focus: CellAddress } |
  { kind: "cells"; id: string; cells: CellAddress[] } |
  { kind: "rows"; id: string; rows: string[]; start: string } |
  { kind: "columns"; id: string; columns: string[]; start: string });
export type CellSelection = Extract<TableSelection, { kind: "cell" }>;
export type TableLayout = { box: Rectangle; rows: number[]; minimums: number[]; unmerged: number[] };
export type TableBorder = { axis: TableAxis; index: number; id: string; edge: number };
export type TableGhost = { x: number; y: number; width: number; height: number; columns: number; rows: number };
export type TableAction = { axis: TableAxis; at: "before" | "after" | "end" | "delete" } |
  { axis: TableAxis; at: "move"; by: 1 | -1 } | { axis: TableAxis; at: "move"; to: number } |
  { axis: TableAxis; at: "duplicate" } | { axis: TableAxis; at: "insert"; gap: number } |
  { at: "merge"; axis?: TableAxis } | { at: "split" } | { at: "clear" };
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
    if (mergeOf(t, cell)) continue;
    const width = widths.get(cell.column), height = heights.get(cell.row);
    if (width !== undefined && height !== undefined) heights.set(cell.row, Math.max(height,
      line * Math.max(1, measure(cell.text, width - 2 * TABLE_INSET, size))));
  }
  const minimums = t.rows.map(r => heights.get(r.id)! + 2 * TABLE_INSET);
  const unmerged = t.rows.map((r, i) => Math.max(r.height, minimums[i]));
  const rows = [...unmerged];
  const merges = (t.merges ?? []).map(merge => ({ merge, ...cellIndex(t, merge) }))
    .sort((a, b) => a.row - b.row || a.column - b.column);
  for (const { merge, row, column } of merges) {
    const end = row + merge.rows;
    const span = prefix(rows, end) - prefix(rows, row);
    const width = t.columns.slice(column, column + merge.columns).reduce((sum, c) => sum + c.width, 0);
    const text = cells.find(cell => cellKey(cell) === cellKey(merge))?.text ?? "";
    const needed = line * Math.max(1, measure(text, width - 2 * TABLE_INSET, size)) + 2 * TABLE_INSET;
    rows[end - 1] += Math.max(0, needed - span);
  }
  return { rows, minimums, unmerged, box: { x: t.x, y: t.y, width: t.width, height: rows.reduce((a, b) => a + b, 0) } };
}
export function growTable(t: TableItem, measure: MeasureCell) {
  const layout = layoutTable(t, measure);
  const rows = t.rows.map((r, i) => ({ ...r, height: Math.min(MAX_TABLE_SIZE, layout.unmerged[i]) }));
  return boundTable(sizeTable({ ...t, rows }));
}
export function boundTable(t: TableItem, height = t.height): TableItem {
  return { ...t, x: Math.max(-1e6, Math.min(1e6 - t.width, Math.round(t.x))),
    y: Math.max(-1e6, Math.min(1e6 - height, Math.round(t.y))) };
}
export const anchorCell = selectionAnchor;
const prefix = (numbers: number[], i: number) => numbers.slice(0, i).reduce((a, b) => a + b, 0);

function boundsBox(t: TableKeys, layout: TableLayout, b: TableBounds): Rectangle {
  const columns = t.columns.map(c => c.width);
  const x = prefix(columns, b.left), y = prefix(layout.rows, b.top);
  return { x: layout.box.x + x, y: layout.box.y + y,
    width: prefix(columns, b.right + 1) - x, height: prefix(layout.rows, b.bottom + 1) - y };
}
export function cellBox(t: TableKeys, layout: TableLayout, cell: CellAddress): Rectangle | undefined {
  const merge = mergeOf(t, cell);
  const { row, column } = cellIndex(t, merge ?? cell);
  if (row < 0 || column < 0) return;
  return boundsBox(t, layout, { top: row, left: column,
    bottom: row + (merge?.rows ?? 1) - 1, right: column + (merge?.columns ?? 1) - 1 });
}
function axisBox(t: TableKeys, layout: TableLayout, axis: TableAxis, ids: string[]) {
  const entries = axis === "row" ? t.rows : t.columns;
  const first = entries.findIndex(entry => entry.id === ids[0]);
  const last = entries.findIndex(entry => entry.id === ids.at(-1));
  if (first < 0 || last < 0) return layout.box;
  return boundsBox(t, layout, axis === "row" ? { top: first, bottom: last, left: 0, right: t.columns.length - 1 }
    : { top: 0, bottom: t.rows.length - 1, left: first, right: last });
}
export function selectionBox(t: TableKeys, layout: TableLayout, selection: TableSelection): Rectangle {
  if (selection.kind === TABLE_LEVEL || selection.kind === "rows") return layout.box;
  if (selection.kind === "range") {
    const bounds = rangeBounds(t, { from: selection.anchor, to: selection.focus });
    return bounds ? boundsBox(t, layout, bounds) : layout.box;
  }
  if (selection.kind === "cells") {
    const boxes = selectionCells(t, selection).map(cell => cellBox(t, layout, cell)!);
    if (!boxes.length) return layout.box;
    const x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y));
    return { x, y, width: Math.max(...boxes.map(b => b.x + b.width)) - x,
      height: Math.max(...boxes.map(b => b.y + b.height)) - y };
  }
  if (selection.kind === "cell") return cellBox(t, layout, selection) ?? layout.box;
  const axis = selection.kind === "row" ? "row" : "column";
  return axisBox(t, layout, axis, chosenIds(t, selection, axis));
}
export function hitCell(t: TableKeys, layout: TableLayout, p: Point) {
  const { box, rows } = layout;
  const find = (value: number, sizes: number[]) => value < 0 ? -1 :
    sizes.findIndex((_, i) => value < prefix(sizes, i + 1) || i === sizes.length - 1 && value === prefix(sizes, i + 1));
  const cell = cellAt(t, find(p.y - box.y, rows), find(p.x - box.x, t.columns.map(c => c.width)));
  const merge = cell && mergeOf(t, cell);
  return merge ? { row: merge.row, column: merge.column } : cell;
}
export function tableBorders(t: TableKeys, layout: TableLayout): TableBorder[] {
  return [
    ...t.columns.map((c, index) => ({ axis: "column" as const, id: c.id, index, edge: layout.box.x + prefix(t.columns.map(c => c.width), index + 1) })),
    ...t.rows.map((r, index) => ({ axis: "row" as const, id: r.id, index, edge: layout.box.y + prefix(layout.rows, index + 1) })),
  ];
}
function gridSegments(t: TableKeys, layout: TableLayout, b: TableBorder) {
  const row = b.axis === "row";
  const lengths = row ? t.columns.map(c => c.width) : layout.rows;
  const origin = row ? layout.box.x : layout.box.y;
  const line = (start: number, end: number) => row ? [start, b.edge, end, b.edge] : [b.edge, start, b.edge, end];
  const gaps = (t.merges ?? []).flatMap(merge => {
    const anchor = cellIndex(t, merge), gap = b.index + 1;
    const start = anchor[b.axis], length = row ? merge.rows : merge.columns;
    if (gap <= start || gap >= start + length) return [];
    const cross = row ? anchor.column : anchor.row;
    return [{ start: cross, end: cross + (row ? merge.columns : merge.rows) }];
  }).sort((a, b) => a.start - b.start);
  const result: { id: string; points: number[] }[] = [];
  let start = 0;
  for (const gap of gaps) {
    if (gap.start > start) result.push({ id: b.id + ":" + start, points: line(origin + prefix(lengths, start), origin + prefix(lengths, gap.start)) });
    start = gap.end;
  }
  if (start < lengths.length) result.push({ id: start ? b.id + ":" + start : b.id,
    points: line(origin + prefix(lengths, start), origin + prefix(lengths, lengths.length)) });
  return result;
}
export function tableGridLines(t: TableKeys, layout: TableLayout) {
  return tableBorders(t, layout).filter(b => b.index < (b.axis === "row" ? t.rows.length : t.columns.length) - 1)
    .flatMap(b => gridSegments(t, layout, b));
}
export function hitBorder(t: TableKeys, layout: TableLayout, p: Point, zoom = 1) {
  const distance = (b: TableBorder) => Math.abs((b.axis === "row" ? p.y : p.x) - b.edge) * zoom;
  return tableBorders(t, layout).filter(b => distance(b) <= 4 && gridSegments(t, layout, b).some(({ points }) =>
    b.axis === "row" ? points[0] <= p.x && p.x <= points[2] : points[1] <= p.y && p.y <= points[3]))
    .sort((a, b) => distance(a) - distance(b))[0];
}
export function selectionOutlines(t: TableKeys, layout: TableLayout, s: TableSelection): { boxes: Rectangle[]; inner: number[][] } {
  if (s.kind === "cells") return { boxes: selectionCells(t, s).map(cell => cellBox(t, layout, cell)!), inner: [] };
  if (s.kind === "rows" || s.kind === "columns") {
    const axis = s.kind === "rows" ? "row" : "column", ids = chosenIds(t, s, axis);
    const runs = isRun(t, axis, ids) ? [ids] : ids.map(id => [id]);
    return { boxes: runs.map(run => axisBox(t, layout, axis, run)), inner: [] };
  }
  const b = selectionBox(t, layout, s);
  const inner = s.kind === "range" ? tableGridLines(t, layout).flatMap(({ points: [x1, y1, x2, y2] }) => {
    if (x1 === x2 && x1 > b.x && x1 < b.x + b.width) {
      const top = Math.max(y1, b.y), bottom = Math.min(y2, b.y + b.height);
      return top < bottom ? [[x1, top, x2, bottom]] : [];
    }
    if (y1 === y2 && y1 > b.y && y1 < b.y + b.height) {
      const left = Math.max(x1, b.x), right = Math.min(x2, b.x + b.width);
      return left < right ? [[left, y1, right, y2]] : [];
    }
    return [];
  }) : [];
  return { boxes: [b], inner };
}
export function tableButtons(t: TableKeys, layout: TableLayout, selection: TableSelection, zoom: number) {
  const cell = anchorCell(t, selection);
  const at = cellIndex(t, cell);
  if (at.row < 0 || at.column < 0) return [];
  const { box } = layout, gap = 8 / zoom, grab = 14 / zoom, hit = 28 / zoom, thick = 24 / zoom;
  const merge = selection.kind === "cell" ? mergeOf(t, selection) : undefined;
  const pill = (axis: TableAxis, id: string) => {
    const row = axis === "row", entries = row ? t.rows : t.columns;
    const index = entries.findIndex(entry => entry.id === id);
    const b = axisBox(t, layout, axis, [id]);
    return {
      x: row ? box.x - grab * 2 : b.x + b.width / 2 - grab,
      y: row ? b.y + b.height / 2 - grab : box.y - grab * 2,
      width: hit, height: hit, axis, id, index, action: "select" as const, selected: axisSelected(selection, axis),
    };
  };
  const add = (axis: TableAxis, rect: Rectangle) => ({
    ...rect, axis, action: "add" as const, index: at[axis], id: cell[axis], selected: selection.kind === axis,
  });
  return [
    ...(axisSelected(selection, "column") ? chosenIds(t, selection, "column").map(id => pill("column", id))
      : selection.kind === "cell" && (!merge || merge.columns === 1) ? [pill("column", cell.column)] : []),
    ...(axisSelected(selection, "row") ? chosenIds(t, selection, "row").map(id => pill("row", id))
      : selection.kind === "cell" && (!merge || merge.rows === 1) ? [pill("row", cell.row)] : []),
    ...(selection.kind === TABLE_LEVEL || at.column === t.columns.length - 1 ? [add("column", {
      x: box.x + box.width + gap, y: box.y, width: thick, height: box.height })] : []),
    ...(selection.kind === TABLE_LEVEL || at.row === t.rows.length - 1 ? [add("row", {
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
    origin: "own" | "remote" | "reload", label = "Someone", before?: TableItem) {
  if (!t || t.id !== s.id) return { selection: null, notice: "" };
  const selection = keepSelection(t, s);
  if (s.kind !== TABLE_LEVEL && selection.kind === TABLE_LEVEL && origin === "remote") {
    const cells = s.kind === "range" ? [s.anchor, s.focus] : s.kind === "cells" ? s.cells : [];
    const rows = s.kind === "rows" ? s.rows : "row" in s ? [s.row] : cells.map(c => c.row);
    const columns = s.kind === "columns" ? s.columns : "column" in s ? [s.column] : cells.map(c => c.column);
    const missing = rows.some(id => !t.rows.some(r => r.id === id)) ? "row"
      : columns.some(id => !t.columns.some(c => c.id === id)) ? "column" : undefined;
    if (missing) return { selection, notice: `${label} deleted a ${missing} you ${editing ? "were editing" : "had selected"}.` };
  }
  if (editing && s.kind === "cell" && selection.kind === "cell" && selection !== s && origin === "remote") {
    const merge = mergeOf(t, s);
    if (merge && !before?.merges.some(old => cellKey(old) === cellKey(merge) && old.rows === merge.rows && old.columns === merge.columns)) {
      return { selection, notice: `${label} merged cells you were editing.` };
    }
  }
  return { selection, notice: "" };
}
export function tableReason(t: TableKeys, axis: TableAxis, action: "add" | "delete") {
  const count = (axis === "row" ? t.rows : t.columns).length;
  const maximum = axis === "row" ? MAX_ROWS : MAX_COLUMNS;
  if (action === "delete" && count <= 1) return `A table needs at least one ${axis}`;
  if (action === "add" && count >= maximum) return `A table holds at most ${maximum} ${axis}s`;
  return "";
}
export const tableMode = (selection: TableSelection, editing: boolean) => editing ? "Editing" :
  { table: "Table", cell: "Cell", row: "Row", column: "Column", range: "Cells", cells: "Cells", rows: "Rows", columns: "Columns" }[selection.kind];
export function cellName(t: TableKeys, cell: CellAddress) {
  const { row, column } = cellIndex(t, cell);
  return `Row ${row + 1}, column ${column + 1}`;
}
export const announceCell = (t: TableKeys, cell: CellAddress) => cellName(t, cell) + ": " + (cellText(t, cell) || "empty");
export const selectionAnnouncement = (t: TableKeys, s: TableSelection) => s.kind === "cell" ? announceCell(t, s) : selectedText(t, s);
export const editorName = (t: TableKeys, cell: CellAddress, name: string) => cellName(t, cell) + " of " + name;

type Key = { key: string; code: string; shiftKey: boolean; altKey: boolean; metaKey: boolean; ctrlKey: boolean };
export function tableKey(t: TableKeys, s: TableSelection, e: Key, editing: boolean, readOnly: boolean, composing: boolean):
    { action: TableAction } | { select: CellAddress } | { edit: CellAddress } | { choose: TableSelection } |
    { exit: boolean } | { consume: true } | undefined {
  if (readOnly || composing) return;
  const cells = s.kind === "range" || s.kind === "cells";
  const axis = s.kind === "row" || s.kind === "rows" ? "row" : s.kind === "column" || s.kind === "columns" ? "column" : undefined;
  if (e.metaKey || e.ctrlKey) {
    if (!editing && e.key.toLowerCase() === "d" && !e.shiftKey && !e.altKey && s.kind !== TABLE_LEVEL)
      return axis ? { action: { axis, at: "duplicate" } } : { consume: true };
    return;
  }
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
    if (e.code === "KeyM" && !e.shiftKey) {
      if (s.kind === "cell" && mergeOf(t, at)) return { action: { at: "split" } };
      if (s.kind === "range" || axis && isRun(t, axis, chosenIds(t, s, axis))) return { action: { at: "merge" } };
      return { consume: true };
    }
    if (e.code === "Enter") return cells ? { consume: true } : { action: { axis: "row", at: e.shiftKey ? "before" : "after" } };
    if (!e.shiftKey && (e.code === "BracketLeft" || e.code === "BracketRight"))
      return cells ? { consume: true } : { action: { axis: "column", at: e.code === "BracketLeft" ? "before" : "after" } };
    return;
  }
  if (e.key === "Escape") return { exit: s.kind === TABLE_LEVEL };
  if (s.kind === TABLE_LEVEL) return e.key === "Enter" ? { select: at } : undefined;
  if (e.key === "Delete" || e.key === "Backspace") return { action: axis ? { axis, at: "delete" } : { at: "clear" } };
  const arrow = e.key.startsWith("Arrow");
  if (arrow && e.shiftKey) {
    if (s.kind === "cell" || s.kind === "range") {
      const moved = moveFocus(t, s, e.key);
      if (moved !== s) return { choose: moved };
    }
    return { consume: true };
  }
  if (s.kind === "cell" || cells) {
    if (e.key === "Enter") return { edit: at };
    if (e.key === "Tab" || arrow) {
      const next = e.key === "Tab" ? nextCell(t, at, e.shiftKey ? -1 : 1) : neighbourCell(t, at, e.key);
      if (next || cells) return { select: next ?? at };
    }
  }
  if (e.key === "Tab" || e.key === "Enter" || arrow) return { consume: true };
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
