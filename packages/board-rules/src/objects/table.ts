// SPDX-License-Identifier: Apache-2.0
import { TEXT_SIZES, type Style } from "../styles.ts";

export const MAX_COLUMNS = 20, MAX_ROWS = 50, MAX_CELL_TEXT = 1000, MAX_BOARD_CELLS = 5000;
export const MIN_TABLE_SIZE = 64, MAX_TABLE_SIZE = 1000, COLUMN_WIDTH = 192, ROW_HEIGHT = 64;
export const TABLE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export type CellAddress = { row: string; column: string };
export type TableCell = CellAddress & { text: string };
export type TableColumn = { id: string; width: number };
export type TableRow = { id: string; height: number };
export type TableAxis = "column" | "row";
export type TableKeys = {
  columns: TableColumn[]; rows: TableRow[]; cells: TableCell[]; textSize: Style["textSize"];
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
  return [...t.cells].every(c => exact(c, ["row", "column", "text"]) && rows.has(c.row) && columns.has(c.column) && validCellText(c.text) && c.text.length > 0) &&
    new Set(t.cells.map(cellKey)).size === t.cells.length;
}

export function canonicalTable(t: TableKeys): TableKeys {
  const rows = new Map(t.rows.map((row, index) => [row.id, index]));
  const columns = new Map(t.columns.map((column, index) => [column.id, index]));
  return {
    columns: t.columns.map(({ id, width }) => ({ id, width })),
    rows: t.rows.map(({ id, height }) => ({ id, height })),
    cells: t.cells.map(({ row, column, text }) => ({ row, column, text }))
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
    cells: [], textSize: "medium", width: columns * COLUMN_WIDTH, height: rows * ROW_HEIGHT,
  };
}

export function insertAxis<T extends TableKeys>(t: T, axis: TableAxis, id: string, at = axis === "row" ? t.rows.length : t.columns.length): T {
  if (t.rows.some(r => r.id === id) || t.columns.some(c => c.id === id)) return t;
  if (axis === "row") {
    if (t.rows.length >= MAX_ROWS) return t;
    const rows = [...t.rows];
    rows.splice(at, 0, { id, height: ROW_HEIGHT });
    return sizeTable({ ...t, rows });
  }
  if (t.columns.length >= MAX_COLUMNS) return t;
  const columns = [...t.columns];
  columns.splice(at, 0, { id, width: COLUMN_WIDTH });
  return sizeTable({ ...t, columns });
}

export function deleteAxis<T extends TableKeys>(t: T, axis: TableAxis, id: string): T {
  const entries = axis === "row" ? t.rows : t.columns;
  if (entries.length === 1 || !entries.some(entry => entry.id === id)) return t;
  const cells = t.cells.filter(cell => cell[axis] !== id);
  return sizeTable(axis === "row" ? { ...t, cells, rows: t.rows.filter(r => r.id !== id) }
    : { ...t, cells, columns: t.columns.filter(c => c.id !== id) });
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

export function nextCell(t: TableKeys, at: CellAddress, direction: 1 | -1): CellAddress | undefined {
  const { row, column } = cellIndex(t, at);
  if (row < 0 || column < 0) return;
  const width = t.columns.length, index = row * width + column + direction;
  return cellAt(t, Math.floor(index / width), index % width);
}

export function neighbourCell(t: TableKeys, at: CellAddress, arrow: string): CellAddress | undefined {
  const { row, column } = cellIndex(t, at);
  if (row < 0 || column < 0) return;
  return cellAt(t, row + Number(arrow === "ArrowDown") - Number(arrow === "ArrowUp"),
    column + Number(arrow === "ArrowRight") - Number(arrow === "ArrowLeft"));
}

export function remapTable<T extends TableKeys>(t: T, id: () => string = () => crypto.randomUUID()): T {
  const rows = new Map(t.rows.map(r => [r.id, id()]));
  const columns = new Map(t.columns.map(c => [c.id, id()]));
  return { ...t, columns: t.columns.map(c => ({ ...c, id: columns.get(c.id)! })),
    rows: t.rows.map(r => ({ ...r, id: rows.get(r.id)! })),
    cells: t.cells.map(c => ({ row: rows.get(c.row)!, column: columns.get(c.column)!, text: c.text })) };
}

export const table = {
  voting: true, type: "table", label: "Table", tool: "Table", validFrom: 14, body: "table-body",
  points: false, text: false, ends: false, container: false, richText: false, kinds: [],
  extraKeys: [] as readonly string[],
  savedKeys: ["id", "generation", "type", "page", "columns", "rows", "cells", "textSize", "group", "section", "x", "y", "width", "height", "order"],
  validExtras: validTable, sizeRange: { min: 64, max: 50_000, minWidth: 64 }, shapePaint: false, growsWithText: false, draws: false, previewRadius: 12,
  labelPrefix: (_o: object) => "table", contextLabel: (_o: object) => "Table",
} as const;
