// SPDX-License-Identifier: Apache-2.0
import { add, canonical, count, tableCellCount, validText, type BoardV14, type TableItem } from "nextphase-board-rules/document.ts";
import { cellText, isTable, MAX_BOARD_CELLS, MAX_CELL_TEXT, MAX_COLUMNS, MAX_ROWS, table,
  type TableKeys } from "nextphase-board-rules/objects/registry.ts";
import { placeObject } from "./sections.ts";

const INPUT_LIMIT = 393_216;
const EDIT_LIMIT = 1_048_576;
const utf8 = new TextEncoder();
const integer = (value: number) => value.toLocaleString("en-US");

type Point = { x: number; y: number };
type Separator = "," | "\t";
type FileInfo = { name: string; type: string };
type FileInput = FileInfo & { size: number; arrayBuffer(): Promise<ArrayBuffer> };
type Grid = { rows: string[][]; columns: number; bytes: number; textBytes: number };
type Parsed = { name?: string; grid: Grid };
type Refused = { name?: string; reason: string };
export type TableDataItem = Parsed | Refused;
export type TableDataAnchor = { boardId: string; page: string; point: Point };
type PlaceTable = (table: TableItem, centre: Point) => TableItem;

export function isCanvasPasteTarget({ target, currentTarget }: { target: EventTarget | null; currentTarget: Element }) {
  if (target === currentTarget) return true;
  const element = target as Element | null;
  return typeof element?.closest === "function" && currentTarget.contains(element) &&
    !element.closest("textarea,input,[contenteditable]:not([contenteditable=false])");
}

export function isSpreadsheetData(text: string, html: string) {
  return text !== "" && (text.includes("\t") || /<table[\s>]/i.test(html));
}

export function isCsvFile({ name, type }: FileInfo) {
  return /\.csv$/i.test(name) || type === "text/csv";
}

const isBreak = (value: string) => value === "\n" || value === "\r";
const breakWidth = (text: string, i: number) => text[i] === "\r" && text[i + 1] === "\n" ? 2 : 1;

function readRecords(text: string, separator: Separator): string[][] | string {
  const rows: string[][] = [];
  let row: string[] = [], i = 0, line = 1;
  while (i < text.length) {
    let field = "";
    if (text[i] === '"') {
      const openingLine = line;
      let closed = false;
      i++;
      while (i < text.length) {
        if (text[i] === '"') {
          i++;
          if (text[i] !== '"') { closed = true; break; }
          field += '"';
          i++;
        } else if (isBreak(text[i])) {
          field += "\n";
          i += breakWidth(text, i);
          line++;
        } else {
          field += text[i++];
        }
      }
      if (!closed) return `line ${integer(openingLine)} has a quote that is not closed`;
      if (i < text.length && text[i] !== separator && !isBreak(text[i])) {
        return `line ${integer(line)} has text after a closing quote`;
      }
    } else {
      const start = i;
      while (i < text.length && text[i] !== separator && !isBreak(text[i])) i++;
      field = text.slice(start, i);
    }
    row.push(field);
    if (text[i] === separator) {
      i++;
      if (i === text.length) row.push("");
    } else if (i < text.length) {
      rows.push(row);
      row = [];
      i += breakWidth(text, i);
      line++;
    }
  }
  if (row.length) rows.push(row);
  return rows;
}

function readTable(text: string, separator: Separator, bytes: number, name?: string): TableDataItem {
  const refuse = (reason: string) => ({ name, reason });
  const rows = readRecords(text, separator);
  if (typeof rows === "string") return refuse(rows);
  if (!rows.some(row => row.some(field => field !== ""))) return refuse("it holds no text");
  const columns = rows.reduce((width, row) => Math.max(width, row.length), 0);
  const source = name === undefined ? "data" : "file";
  if (columns > MAX_COLUMNS) return refuse(`a table holds at most 20 columns, and this ${source} has ${integer(columns)}`);
  if (rows.length > MAX_ROWS) return refuse(`a table holds at most 50 rows, and this ${source} has ${integer(rows.length)}`);
  let textBytes = 0;
  let invalidField = "";
  for (const [r, row] of rows.entries()) {
    for (const [c, field] of row.entries()) {
      const length = count(field);
      if (length > MAX_CELL_TEXT) {
        return refuse(`a cell holds up to 1,000 characters, and row ${r + 1}, column ${c + 1} has ${integer(length)}`);
      }
      if (!invalidField && !validText(field, MAX_CELL_TEXT)) {
        invalidField = `row ${r + 1}, column ${c + 1} holds text a table cannot store`;
      }
      textBytes += utf8.encode(field).length;
    }
    while (row.length < columns) row.push("");
  }
  return invalidField ? refuse(invalidField) : { name, grid: { rows, columns, bytes, textBytes } };
}

export function readSpreadsheet(text: string): TableDataItem {
  const bytes = utf8.encode(text).length;
  return bytes > INPUT_LIMIT ? { reason: "the data is larger than 384 KiB" } : readTable(text, "\t", bytes);
}

export async function readCsvFile(file: FileInput): Promise<TableDataItem> {
  const name = file.name || "Clipboard file";
  if (!isCsvFile(file)) return { name, reason: "it is not a CSV file" };
  if (file.size > INPUT_LIMIT) return { name, reason: "the file is larger than 384 KiB" };
  let bytes: ArrayBuffer;
  try { bytes = await file.arrayBuffer(); }
  catch { return { name, reason: "the file could not be read" }; }
  let text: string;
  // The decoder removes the first BOM and leaves any second BOM as text.
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return { name, reason: "the file is not UTF-8 text" }; }
  return readTable(text, ",", file.size, name);
}

export const hostedEditEstimate = (textBytes: number, cells: number) =>
  Math.ceil(4 / 3 * (textBytes + 128 * cells + 65_536));

function withTable(board: BoardV14, grid: Grid, page: string, centre: Point, place: PlaceTable) {
  const created = add(board, table.type, 0, 0, page, { columns: grid.columns, rows: grid.rows.length }).objects.at(-1)!;
  if (!isTable(created)) throw Error("Expected a new table");
  const cells = grid.rows.flatMap((row, r) => row.flatMap((text, c) =>
    text === "" ? [] : [{ row: created.rows[r].id, column: created.columns[c].id, text }]));
  return { board: placeObject(board, place({ ...created, cells }, centre)), id: created.id };
}

function payloadReason(board: BoardV14) {
  try {
    canonical(board.title.trim() ? board : { ...board, title: "x" });
    // canonical enforces the 2 MiB limit with payloadBytes.
    return "";
  } catch (error) {
    if (error instanceof Error && error.message === "Board too large") return "the board would be larger than 2 MiB";
    throw error;
  }
}

export function addTableData(board: BoardV14, items: readonly TableDataItem[], anchor: TableDataAnchor,
  hosted: boolean, place: PlaceTable) {
  let next = board, bytes = 0, cells = tableCellCount(board.objects), editCells = 0, editBytes = 0;
  const ids: string[] = [], accepted: Parsed[] = [], refused: Refused[] = [];
  for (const item of items) {
    if ("reason" in item) { refused.push(item); continue; }
    const { name, grid } = item;
    const cellCount = grid.columns * grid.rows.length;
    const reason = name !== undefined && bytes + grid.bytes > INPUT_LIMIT
      ? "the files together are larger than 384 KiB"
      : cells + cellCount > MAX_BOARD_CELLS
      ? `a board holds at most 5,000 table cells, and this table would bring it to ${integer(cells + cellCount)}`
      : next.objects.length >= 250 ? "a board holds at most 250 objects" : "";
    if (reason) { refused.push({ name, reason }); continue; }

    const offset = 24 * accepted.length;
    const placed = withTable(next, grid, anchor.page, { x: anchor.point.x + offset, y: anchor.point.y + offset }, place);
    const budgetReason = payloadReason(placed.board) || (hosted &&
      hostedEditEstimate(editBytes + grid.textBytes, editCells + cellCount) > EDIT_LIMIT ? "the tables are too large to send in one edit" : "");
    if (budgetReason) { refused.push({ name, reason: budgetReason }); continue; }

    next = placed.board;
    ids.push(placed.id);
    accepted.push(item);
    bytes += grid.bytes;
    cells += cellCount;
    editCells += cellCount;
    editBytes += grid.textBytes;
  }
  return { board: next, ids, success: successNotice(accepted), refusal: refusalNotice(refused) };
}

function successNotice(accepted: readonly Parsed[]) {
  if (!accepted.length) return "";
  if (accepted.length > 1) return `Added ${integer(accepted.length)} tables.`;
  const [{ name, grid }] = accepted;
  return `Added a ${grid.columns} × ${grid.rows.length} table${name === undefined ? "" : ` from “${name}”`}.`;
}

function refusalNotice(refused: readonly Refused[]) {
  if (!refused.length) return "";
  if (refused[0].name === undefined) return `Could not paste the table: ${refused[0].reason}.`;
  const names = refused.slice(0, 3).map(item => `“${item.name}”`);
  const more = refused.length - names.length;
  const files = names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names.at(-1) : names[0];
  const reasons = [...new Set(refused.map(item => item.reason))];
  return `Could not import ${files}${more ? ` and ${integer(more)} more` : ""}: ${reasons.join("; ")}.`;
}

const quote = (text: string, specials: RegExp) => specials.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
const number = /^[+-]?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/;
const formulaText = (text: string) => /^[=+\-@\t\r]/.test(text) && !number.test(text) ? "'" + text : text;

function writeRows(table: TableKeys, separator: Separator, write: (text: string) => string) {
  return table.rows.map(row => table.columns.map(column => write(cellText(table, { row: row.id, column: column.id }))).join(separator));
}

export function tableTsv(table: TableKeys) {
  return writeRows(table, "\t", text => quote(text, /[\t\r\n"]/)).join("\n");
}

export const csvField = (text: string) => quote(formulaText(text), /[,\r\n"]/);

export function tableCsvBody(table: TableKeys) {
  return writeRows(table, ",", csvField).join("\r\n") + "\r\n";
}

export function tableCsv(table: TableKeys) {
  return "\uFEFF" + tableCsvBody(table);
}

export function tableCsvName(title: string) {
  let name = title.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, "_").replace(/[ .]+$/, "_");
  if (/^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(?:\.|$)/i.test(name)) name = "_" + name;
  return (name || "Untitled board") + " table.csv";
}
