// SPDX-License-Identifier: Apache-2.0
import { cellAt, cellIndex, mergeOf, rangeBounds, neighbourCell,
  type CellAddress, type CellRange, type TableAxis, type TableBounds, type TableKeys } from "nextphase-board-rules/objects/registry.ts";
import type { TableSelection } from "./table.ts";

const sameCell = (a: CellAddress, b: CellAddress) => a.row === b.row && a.column === b.column;
const liveCell = (t: TableKeys, cell: CellAddress) => {
  const { row, column } = cellIndex(t, cell);
  return row >= 0 && column >= 0;
};
function mergeAnchor(t: TableKeys, cell: CellAddress): CellAddress {
  const merge = mergeOf(t, cell);
  return merge ? { row: merge.row, column: merge.column } : cell;
}
function axisEntries(t: TableKeys, axis: TableAxis) { return axis === "row" ? t.rows : t.columns; }

export function boundsCells(t: TableKeys, b: TableBounds): CellAddress[] {
  const result: CellAddress[] = [];
  for (let row = b.top; row <= b.bottom; row++) {
    for (let column = b.left; column <= b.right; column++) {
      const cell = cellAt(t, row, column);
      if (cell && sameCell(mergeAnchor(t, cell), cell)) result.push(cell);
    }
  }
  return result;
}

export function selectionAnchor(t: TableKeys, s: TableSelection): CellAddress {
  if (s.kind === "range") return mergeAnchor(t, s.anchor);
  if (s.kind === "cells") return selectionCells(t, s)[0] ?? cellAt(t, 0, 0)!;
  return mergeAnchor(t, {
    row: s.kind === "rows" ? chosenIds(t, s, "row")[0] : "row" in s ? s.row : t.rows[0].id,
    column: s.kind === "columns" ? chosenIds(t, s, "column")[0] : "column" in s ? s.column : t.columns[0].id,
  });
}

export function rangeSelection(t: TableKeys, id: string, anchor: CellAddress, focus: CellAddress): TableSelection {
  const b = rangeBounds(t, { from: anchor, to: focus });
  if (!b) return { kind: "table", id };
  const cells = boundsCells(t, b);
  return cells.length === 1 ? { kind: "cell", id, ...cells[0] } : { kind: "range", id, anchor, focus };
}

export function selectionCells(t: TableKeys, s: TableSelection): CellAddress[] {
  if (s.kind === "cell") return liveCell(t, s) ? [mergeAnchor(t, { row: s.row, column: s.column })] : [];
  if (s.kind === "range") {
    const b = rangeBounds(t, { from: s.anchor, to: s.focus });
    return b ? boundsCells(t, b) : [];
  }
  const result: CellAddress[] = [];
  const explicit = s.kind === "cells" ? s.cells : undefined;
  const rows = axisSelected(s, "row") ? new Set(chosenIds(t, s, "row")) : undefined;
  const columns = axisSelected(s, "column") ? new Set(chosenIds(t, s, "column")) : undefined;
  const chosen = new Set<string>();
  for (const row of t.rows) for (const column of t.columns) {
    const at = { row: row.id, column: column.id };
    if (rows && !rows.has(at.row) || columns && !columns.has(at.column) ||
        explicit && !explicit.some(cell => sameCell(at, cell))) continue;
    const anchor = mergeAnchor(t, at), key = anchor.row + ":" + anchor.column;
    if (!chosen.has(key)) { chosen.add(key); result.push(anchor); }
  }
  if (!t.merges.length) return result;
  return result.sort((a, b) => {
    const x = cellIndex(t, a), y = cellIndex(t, b);
    return x.row - y.row || x.column - y.column;
  });
}

export function chosenIds(t: TableKeys, s: TableSelection, axis: TableAxis): string[] {
  if (s.kind === "rows" && axis === "row") return t.rows.map(r => r.id).filter(id => s.rows.includes(id));
  if (s.kind === "columns" && axis === "column") return t.columns.map(c => c.id).filter(id => s.columns.includes(id));
  if (s.kind === "row" && axis === "row") return t.rows.some(r => r.id === s.row) ? [s.row] : [];
  if (s.kind === "column" && axis === "column") return t.columns.some(c => c.id === s.column) ? [s.column] : [];
  return [selectionAnchor(t, s)[axis]];
}

export function axisSelected(s: TableSelection, axis: TableAxis) {
  return axis === "row" ? s.kind === "row" || s.kind === "rows" : s.kind === "column" || s.kind === "columns";
}

export function isRun(t: TableKeys, axis: TableAxis, ids: readonly string[]) {
  const entries = axisEntries(t, axis);
  const indices = entries.flatMap((entry, index) => ids.includes(entry.id) ? [index] : []);
  return !!ids.length && indices.length === ids.length && indices.at(-1)! - indices[0] + 1 === ids.length;
}

type Modifiers = { shiftKey: boolean; altKey: boolean; metaKey: boolean; ctrlKey: boolean };
export function chooseHow(e: Modifiers, mac: boolean): "range" | "toggle" | undefined {
  if (e.altKey) return;
  if (e.shiftKey) return !e.metaKey && !e.ctrlKey ? "range" : undefined;
  if (mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey) return "toggle";
}

function cellsSelection(id: string, cells: CellAddress[]): TableSelection {
  if (!cells.length) return { kind: "table", id };
  if (cells.length === 1) return { kind: "cell", id, ...cells[0] };
  return { kind: "cells", id, cells };
}

export function chooseCell(t: TableKeys, s: TableSelection, cell: CellAddress, how?: "range" | "toggle"): TableSelection {
  const at = mergeAnchor(t, cell);
  if (!how || s.kind !== "cell" && s.kind !== "range" && s.kind !== "cells") return { kind: "cell", id: s.id, ...at };
  if (how === "range") return rangeSelection(t, s.id, selectionAnchor(t, s), at);
  const previous = selectionCells(t, s);
  const cells = previous.some(c => sameCell(c, at)) ? previous.filter(c => !sameCell(c, at)) : [...previous, at];
  return cellsSelection(s.id, selectionCells(t, { kind: "cells", id: s.id, cells }));
}

function axisSelection(id: string, axis: TableAxis, ids: string[], start: string): TableSelection {
  if (!ids.length) return { kind: "table", id };
  if (axis === "row") return ids.length === 1 ? { kind: "row", id, row: ids[0] } : { kind: "rows", id, rows: ids, start };
  return ids.length === 1 ? { kind: "column", id, column: ids[0] } : { kind: "columns", id, columns: ids, start };
}

export function chooseAxis(t: TableKeys, s: TableSelection, axis: TableAxis, id: string, how?: "range" | "toggle"): TableSelection {
  const entries = axisEntries(t, axis).map(entry => entry.id);
  if (!entries.includes(id)) return s;
  if (!how || !axisSelected(s, axis)) return axisSelection(s.id, axis, [id], id);
  const previous = chosenIds(t, s, axis);
  if (how === "toggle") {
    return axisSelection(s.id, axis, entries.filter(value => value === id ? !previous.includes(value) : previous.includes(value)), id);
  }
  const start = "start" in s && entries.includes(s.start) ? s.start : previous[0] ?? id;
  const a = entries.indexOf(start), b = entries.indexOf(id);
  return axisSelection(s.id, axis, entries.slice(Math.min(a, b), Math.max(a, b) + 1), start);
}

export function moveFocus(t: TableKeys, s: TableSelection, arrow: string): TableSelection {
  if (s.kind !== "cell" && s.kind !== "range") return s;
  const anchor = s.kind === "range" ? s.anchor : { row: s.row, column: s.column };
  const focus = neighbourCell(t, s.kind === "range" ? s.focus : anchor, arrow);
  return focus ? rangeSelection(t, s.id, anchor, focus) : s;
}

export function keepSelection(t: TableKeys, s: TableSelection): TableSelection {
  switch (s.kind) {
    case "table": return s;
    case "cell": {
      const at = { row: s.row, column: s.column };
      if (!liveCell(t, at)) return { kind: "table", id: s.id };
      const cell = mergeAnchor(t, at);
      return sameCell(at, cell) ? s : { kind: "cell", id: s.id, ...cell };
    }
    case "range": {
      const result = rangeSelection(t, s.id, s.anchor, s.focus);
      return result.kind === "range" ? s : result;
    }
    case "cells": {
      const cells = s.cells.filter(cell => liveCell(t, cell)).map(cell => mergeAnchor(t, cell));
      if (cells.length === s.cells.length && cells.every((cell, i) => sameCell(cell, s.cells[i]))) return s;
      return cellsSelection(s.id, selectionCells(t, { ...s, cells }));
    }
    case "row": case "column":
      return chosenIds(t, s, s.kind).length ? s : { kind: "table", id: s.id };
    case "rows": case "columns": {
      const axis = s.kind === "rows" ? "row" : "column";
      const ids = chosenIds(t, s, axis), old = s.kind === "rows" ? s.rows : s.columns;
      const start = axisEntries(t, axis).some(entry => entry.id === s.start) ? s.start : ids[0];
      return ids.length === old.length && start === s.start ? s : axisSelection(s.id, axis, ids, start);
    }
  }
}

export function mergeTarget(t: TableKeys, s: TableSelection, axis?: TableAxis): CellRange | undefined {
  if (!axis) {
    if (s.kind === "range") return { from: s.anchor, to: s.focus };
    if (axisSelected(s, "row")) axis = "row";
    else if (axisSelected(s, "column")) axis = "column";
    else return;
  }
  const ids = chosenIds(t, s, axis);
  if (!isRun(t, axis, ids)) return;
  const entries = axisEntries(t, axis);
  const first = entries.findIndex(entry => entry.id === ids[0]), last = first + ids.length - 1;
  return axis === "row" ? { from: cellAt(t, first, 0)!, to: cellAt(t, last, t.columns.length - 1)! }
    : { from: cellAt(t, 0, first)!, to: cellAt(t, t.rows.length - 1, last)! };
}

export function countText(t: TableKeys, s: TableSelection): string {
  if (s.kind === "rows") return chosenIds(t, s, "row").length.toLocaleString("en-US") + " rows";
  if (s.kind === "columns") return chosenIds(t, s, "column").length.toLocaleString("en-US") + " columns";
  return s.kind === "cells" || s.kind === "range" ? selectionCells(t, s).length.toLocaleString("en-US") + " cells" : "";
}

export function selectedText(t: TableKeys, s: TableSelection): string {
  const count = countText(t, s);
  return count ? count + " selected" : "";
}
