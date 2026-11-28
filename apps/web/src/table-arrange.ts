// SPDX-License-Identifier: Apache-2.0
import type { TableItem } from "nextphase-board-rules/document.ts";
import { insertAxis, deleteAxis, setCell, mergeOf, rangeBounds, canMerge, mergeRange, splitMerge, canMove, moveAxis, canDuplicate,
  duplicateAxis, cellIndex, cellAt, cellText, MAX_ROWS, MAX_COLUMNS, MAX_BOARD_CELLS,
  type TableAxis, type TableRefusal } from "nextphase-board-rules/objects/registry.ts";
import type { TableOrderHint } from "nextphase-board-sync/document-adapter.ts";
import type { Point } from "./selection.ts";
import type { Rectangle } from "./resize.ts";
import { tableButtons, tableBorders, selectionOutlines, type TableAction, type TableLayout, type TableSelection } from "./table.ts";
import { chosenIds, isRun, keepSelection, mergeTarget, selectionAnchor, selectionCells, rangeSelection } from "./table-selection.ts";

const plural = (axis: TableAxis, several: boolean) => axis + (several ? "s" : "");
const heading = (axis: TableAxis, several: boolean) => (axis === "row" ? "Row" : "Column") + (several ? "s" : "");
export const ARRANGE_WORDS = {
  cells: "Cells", rows: "Rows", columns: "Columns", merge: "Merge cells", mergeTip: "Merge cells ⌥M",
  split: "Split cell", splitTip: "Split cell ⌥M", blocked: "A merged cell is in the way", single: "Already a single cell",
  merged: "Cells merged", splitDone: "Cell split",
  move: (axis: TableAxis, by: number, several: boolean) => "Move " + plural(axis, several) + " " +
    (axis === "row" ? by < 0 ? "up" : "down" : by < 0 ? "left" : "right"),
  duplicate: (axis: TableAxis, several: boolean) => "Duplicate " + plural(axis, several),
  remove: (axis: TableAxis, several: boolean) => "Delete " + plural(axis, several),
  heading,
  insertTip: (axis: TableAxis) => "Insert " + axis,
  insertName: (axis: TableAxis, gap: number) => `Insert ${axis} between ${axis}s ${gap} and ${gap + 1}`,
  inserted: (axis: TableAxis) => heading(axis, false) + " inserted",
  first: (axis: TableAxis) => "Already the first " + axis,
  last: (axis: TableAxis) => "Already the last " + axis,
  apart: (axis: TableAxis) => `Choose ${axis}s next to each other`,
  moved: (axis: TableAxis, from: number, to: number) => `${heading(axis, from !== to)} moved to ${plural(axis, from !== to)} ${from}${from === to ? "" : "–" + to}`,
  duplicated: (axis: TableAxis, several: boolean) => heading(axis, several) + " duplicated",
} as const;
const words = ARRANGE_WORDS;
export type ArrangeRefusal = { code: TableRefusal | "cells"; reason?: string };
export const BOARD_CELLS_REASON = "A board holds at most 5,000 table cells.";

function entries(t: TableItem, axis: TableAxis) { return axis === "row" ? t.rows : t.columns; }
function indices(t: TableItem, axis: TableAxis, ids: string[]) {
  const all = entries(t, axis);
  return { first: all.findIndex(entry => entry.id === ids[0]), last: all.findIndex(entry => entry.id === ids.at(-1)) };
}
const selectionAxis = (s: TableSelection): TableAxis => s.kind === "row" || s.kind === "rows" ? "row" : "column";

export function arrangeRefusal(t: TableItem, s: TableSelection, action: TableAction, cells: number): ArrangeRefusal | null {
  if (action.at === "clear") return null;
  if (action.at === "split") return mergeOf(t, selectionAnchor(t, s)) ? null : { code: "invalid" };
  if (action.at === "merge") {
    const target = mergeTarget(t, s, action.axis);
    if (!target) return s.kind === "rows" || s.kind === "columns"
      ? { code: "notRun", reason: words.apart(action.axis ?? selectionAxis(s)) } : { code: "invalid" };
    const code = canMerge(t, target);
    return code ? { code, reason: code === "single" ? words.single : undefined } : null;
  }
  const { axis } = action, all = entries(t, axis), ids = chosenIds(t, s, axis);
  const { first, last } = indices(t, axis, ids);
  if (first < 0 || last < 0) return { code: "invalid" };
  if (action.at === "move") {
    const gap = "to" in action ? action.to : action.by < 0 ? first - 1 : last + 2;
    const code = canMove(t, axis, ids, gap);
    if (!code) return null;
    const reason = code === "notRun" ? words.apart(axis) : code === "merge" ? words.blocked
      : code === "edge" ? gap < first ? words.first(axis) : words.last(axis) : undefined;
    return { code, reason };
  }
  if (action.at === "delete") return ids.length < all.length ? null
    : { code: "limit", reason: `A table needs at least one ${axis}` };
  if (action.at === "insert" && (!Number.isInteger(action.gap) || action.gap <= 0 || action.gap >= all.length)) return { code: "invalid" };
  const additional = action.at === "duplicate" ? ids.length : 1;
  const across = entries(t, axis === "row" ? "column" : "row").length;
  if (cells + additional * across > MAX_BOARD_CELLS) return { code: "cells", reason: BOARD_CELLS_REASON };
  const max = axis === "row" ? MAX_ROWS : MAX_COLUMNS;
  if (all.length + additional > max) return { code: "limit", reason: `A table holds at most ${max} ${axis}s` };
  if (action.at !== "duplicate") return null;
  const code = canDuplicate(t, axis, ids);
  return code ? { code, reason: code === "notRun" ? words.apart(axis) : code === "merge" ? words.blocked : undefined } : null;
}

export type TableMenuItem = { action: TableAction; name: string; key: string; disabled: boolean; reason?: string; danger: boolean; separatorBefore: boolean };
export function axisMenu(t: TableItem, s: TableSelection, axis: TableAxis, mac: boolean, cells: number) {
  const several = chosenIds(t, s, axis).length > 1, row = axis === "row";
  function item(action: TableAction, name: string, key = "", separatorBefore = false): TableMenuItem {
    const refusal = arrangeRefusal(t, s, action, cells);
    return { action, name, key, separatorBefore, disabled: !!refusal, reason: refusal?.reason, danger: action.at === "delete" };
  }
  return { heading: words.heading(axis, several), items: [
    item({ axis, at: "move", by: -1 }, words.move(axis, -1, several)),
    item({ axis, at: "move", by: 1 }, words.move(axis, 1, several)),
    item({ axis, at: "before" }, row ? "Add row above" : "Add column to the left", row ? "⌥⇧↩" : "⌥[", true),
    item({ axis, at: "after" }, row ? "Add row below" : "Add column to the right", row ? "⌥↩" : "⌥]"),
    item({ axis, at: "duplicate" }, words.duplicate(axis, several), mac ? "⌘D" : "Ctrl+D"),
    item({ at: "merge", axis }, words.merge, "⌥M"),
    item({ axis, at: "delete" }, words.remove(axis, several), "⌫", true),
  ] };
}
export function mergeShown(_t: TableItem, s: TableSelection) {
  return s.kind === "range" || s.kind === "row" || s.kind === "rows" || s.kind === "column" || s.kind === "columns";
}

export type TableHover = { row?: string; column?: string };
export function hoverTarget(t: TableItem, layout: TableLayout, p: Point, zoom: number): TableHover {
  const { box } = layout, outside = 40 / zoom;
  const right = box.x + box.width, bottom = box.y + box.height;
  const borders = tableBorders(t, layout);
  const find = (axis: TableAxis, value: number, end: number) =>
    borders.find(b => b.axis === axis && (value < b.edge || value === end && b.edge === end))?.id;
  const row = p.x >= box.x - outside && p.x <= right && p.y >= box.y && p.y <= bottom ? find("row", p.y, bottom) : undefined;
  const column = p.y >= box.y - outside && p.y <= bottom && p.x >= box.x && p.x <= right ? find("column", p.x, right) : undefined;
  return { ...(row ? { row } : {}), ...(column ? { column } : {}) };
}

export type InsertDot = { axis: TableAxis; gap: number; x: number; y: number; length: number; name: string; reason: string };
export function hoverControls(t: TableItem, layout: TableLayout, s: TableSelection, hover: TableHover, zoom: number, cells: number) {
  const existing = tableButtons(t, layout, s, zoom);
  const grabbers: ReturnType<typeof tableButtons> = [], dots: InsertDot[] = [];
  for (const axis of ["row", "column"] as const) {
    const id = hover[axis], all = entries(t, axis), i = all.findIndex(entry => entry.id === id);
    if (!id || i < 0) continue;
    if (!existing.some(b => b.action === "select" && b.axis === axis && b.id === id)) {
      const selection: TableSelection = axis === "row" ? { kind: "row", id: s.id, row: id } : { kind: "column", id: s.id, column: id };
      const pill = tableButtons(t, layout, selection, zoom).find(b => b.action === "select")!;
      grabbers.push({ ...pill, selected: false });
    }
    for (const gap of [i, i + 1]) {
      if (!gap || gap >= all.length) continue;
      const edge = gapCoordinate(t, layout, axis, gap);
      dots.push({ axis, gap, x: axis === "row" ? layout.box.x - 14 / zoom : edge,
        y: axis === "row" ? edge : layout.box.y - 14 / zoom,
        length: axis === "row" ? layout.box.width : layout.box.height, name: words.insertName(axis, gap),
        reason: arrangeRefusal(t, s, { at: "insert", axis, gap }, cells)?.reason ?? "" });
    }
  }
  return { grabbers, dots };
}

function gapCoordinate(t: TableItem, layout: TableLayout, axis: TableAxis, gap: number) {
  return axis === "row" ? layout.box.y + layout.rows.slice(0, gap).reduce((sum, height) => sum + height, 0)
    : layout.box.x + t.columns.slice(0, gap).reduce((sum, column) => sum + column.width, 0);
}
function spans(t: TableItem, axis: TableAxis) {
  return t.merges.map(merge => {
    const first = cellIndex(t, merge)[axis];
    return { first, end: first + (axis === "row" ? merge.rows : merge.columns) };
  });
}
export function dragStarts(t: TableItem, axis: TableAxis, ids: string[]) {
  if (!isRun(t, axis, ids)) return false;
  const { first, last } = indices(t, axis, ids);
  return !spans(t, axis).some(span => first < span.end && last >= span.first && (first > span.first || last + 1 < span.end));
}
export function ownPlace(t: TableItem, axis: TableAxis, ids: string[], gap: number) {
  const { first, last } = indices(t, axis, ids);
  return first >= 0 && first <= gap && gap <= last + 1;
}
export function dropGap(t: TableItem, layout: TableLayout, axis: TableAxis, ids: string[], p: Point) {
  if (!dragStarts(t, axis, ids)) return;
  const position = axis === "row" ? p.y : p.x, merges = spans(t, axis);
  let nearest: number | undefined, distance = Infinity;
  for (let gap = 0; gap <= entries(t, axis).length; gap++) {
    if (merges.some(span => span.first < gap && gap < span.end)) continue;
    if (!ownPlace(t, axis, ids, gap) && canMove(t, axis, ids, gap)) continue;
    const delta = Math.abs(gapCoordinate(t, layout, axis, gap) - position);
    if (delta < distance) { nearest = gap; distance = delta; }
  }
  return nearest;
}
export function dropLine(t: TableItem, layout: TableLayout, axis: TableAxis, gap: number, zoom: number): [number, number, number, number] {
  const edge = gapCoordinate(t, layout, axis, gap), { x, y, width, height } = layout.box, past = 4 / zoom;
  return axis === "row" ? [x - past, edge, x + width + past, edge] : [edge, y - past, edge, y + height + past];
}
export function dragGhost(t: TableItem, layout: TableLayout, axis: TableAxis, ids: string[], start: Point, p: Point, zoom: number): Rectangle {
  const selection: TableSelection = axis === "row" ? { kind: "rows", id: t.id, rows: ids, start: ids[0] }
    : { kind: "columns", id: t.id, columns: ids, start: ids[0] };
  const box = selectionOutlines(t, layout, selection).boxes[0];
  const offset = 10 / zoom;
  return { ...box, x: box.x + offset + (axis === "column" ? p.x - start.x : 0),
    y: box.y + offset + (axis === "row" ? p.y - start.y : 0) };
}
export function dragSquare(_t: TableItem, layout: TableLayout, axis: TableAxis, p: Point, zoom: number): Point {
  return axis === "row" ? { x: layout.box.x - 14 / zoom, y: p.y } : { x: p.x, y: layout.box.y - 14 / zoom };
}
export type TableDragDrawing = { table: string; axis: TableAxis; ids: string[]; gap?: number; ghost: Rectangle; square: Point };
export type TablePointer = { move(p: Point, e: { buttons: number; pointerType: string; target: EventTarget | null }): void;
  leave(): void; dragging(): boolean; cancel(): void };
export type GrabberRef = { axis: TableAxis; id: string };
export type TableArrangeButtons = { hover: TableHover; dragging?: GrabberRef; square?: Point;
  press(g: GrabberRef, e: PointerEvent, target: Element): void; move(e: PointerEvent): void; release(e: PointerEvent): void;
  lost(): void; key(e: KeyboardEvent): boolean; click(g: GrabberRef, e: MouseEvent): void; insert(axis: TableAxis, gap: number): void };
export type ArrangeResult = { table: TableItem; selection: TableSelection; hint?: TableOrderHint; announcement: string } |
  { refusal: ArrangeRefusal } | null;

export function arrangeTable(t: TableItem, s: TableSelection, action: TableAction, newId: () => string, cells: number): ArrangeResult {
  if (action.at === "move" && "to" in action && ownPlace(t, action.axis, chosenIds(t, s, action.axis), action.to)) return null;
  const refusal = arrangeRefusal(t, s, action, cells);
  if (refusal) return { refusal };
  let next = t, selection = s, hint: TableOrderHint | undefined, announcement = "";
  const anchor = selectionAnchor(t, s);
  if (action.at === "clear") {
    for (const cell of selectionCells(t, s)) if (cellText(next, cell)) next = setCell(next, cell, "");
  } else if (action.at === "merge") {
    const target = mergeTarget(t, s, action.axis)!;
    const bounds = rangeBounds(t, target)!;
    next = mergeRange(t, target);
    selection = { kind: "cell", id: t.id, ...cellAt(t, bounds.top, bounds.left)! };
    announcement = words.merged;
  } else if (action.at === "split") {
    const merge = mergeOf(t, anchor)!;
    const { row, column } = cellIndex(t, anchor);
    next = splitMerge(t, anchor);
    selection = rangeSelection(next, t.id, anchor, cellAt(next, row + merge.rows - 1, column + merge.columns - 1)!);
    announcement = words.splitDone;
  } else {
    const { axis } = action, ids = chosenIds(t, s, axis);
    const { first, last } = indices(t, axis, ids);
    if (action.at === "move") {
      const gap = "to" in action ? action.to : action.by < 0 ? first - 1 : last + 2;
      next = moveAxis(t, axis, ids, gap);
      const moved = indices(next, axis, ids);
      announcement = words.moved(axis, moved.first + 1, moved.last + 1);
      hint = { table: t.id, axis, moved: ids };
    } else if (action.at === "duplicate") {
      next = duplicateAxis(t, axis, ids, newId);
      const copies = entries(next, axis).slice(last + 1, last + 1 + ids.length).map(entry => entry.id);
      const [start] = copies;
      selection = axis === "row" ? copies.length === 1 ? { kind: "row", id: t.id, row: start } : { kind: "rows", id: t.id, rows: copies, start }
        : copies.length === 1 ? { kind: "column", id: t.id, column: start } : { kind: "columns", id: t.id, columns: copies, start };
      announcement = words.duplicated(axis, copies.length > 1);
      hint = { table: t.id, axis, moved: copies };
    } else if (action.at === "delete") {
      for (const id of ids) next = deleteAxis(next, axis, id);
      const at = Math.min(first, entries(next, axis).length - 1);
      selection = keepSelection(next, { kind: "cell", id: t.id, ...anchor, [axis]: entries(next, axis)[at].id });
    } else {
      const gap = action.at === "insert" ? action.gap : action.at === "before" ? first : action.at === "after" ? last + 1 : entries(t, axis).length;
      const size = action.at === "insert" ? axis === "row" ? t.rows[gap - 1].height : t.columns[gap - 1].width : undefined;
      const id = newId();
      next = insertAxis(t, axis, id, gap, size);
      if (action.at === "insert") announcement = words.inserted(axis);
      else selection = keepSelection(next, { kind: "cell", id: t.id, ...anchor, [axis]: id });
      hint = { table: t.id, axis, moved: [id] };
    }
  }
  return next === t ? null : { table: next, selection, hint, announcement };
}
