// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";
import * as Y from "yjs";

const csv = () => import("../apps/web/src/table-csv.ts");
const rules = () => import("../packages/board-rules/src/document.ts");
const webTables = () => import("../apps/web/src/table.ts");
const encoder = new TextEncoder();
const SAMPLE = 'Task\tOwner\tNote\tCost\nBook venue\tAna\t"Line one\nline ""two"""\t-5\nOrder lunch\t\t=SUM(1,2)\t@team';
const MATRIX = [
  ["Task", "Owner", "Note", "Cost"], ["Book venue", "Ana", 'Line one\nline "two"', "-5"],
  ["Order lunch", "", "=SUM(1,2)", "@team"],
];
const LIMIT = 393_216;
const editable = { readOnly: false, composing: false, pointerGesture: false, invalidObjectText: false };
const file = (name, value, type = "") => {
  const bytes = typeof value === "string" ? encoder.encode(value) : new Uint8Array(value);
  return { name, type, size: bytes.length, async arrayBuffer() { return bytes.buffer; } };
};
const csvBlock = (rows, columns, cell) => Array.from({ length: rows },
  (_, r) => Array.from({ length: columns }, (_, c) => cell(r, c)).join(",")).join("\n");
const blank = async () => ({ ...(await rules()).empty(), title: "CSV check" });
const anchor = (b, x = 0, y = 0, page = b.boardId) => ({ boardId: b.boardId, page, point: { x, y } });
const batch = (m, b, items, hosted = false, at = anchor(b)) =>
  m.addTableData(b, items, at, hosted, (t, p) => ({ ...t, x: Math.round(p.x - t.width / 2), y: Math.round(p.y - t.height / 2) }));
const measure = text => text.split("\n").length;
function fill(t, rows) {
  return { ...t, cells: rows.flatMap((line, r) => line.flatMap((text, c) =>
    text === "" ? [] : [{ row: t.rows[r].id, column: t.columns[c].id, text }])) };
}
const otherPage = (b) => ({ ...b, pages: [...b.pages, { id: crypto.randomUUID(), name: "Later" }] });
const matrix = (t) => t.rows.map(r => t.columns.map(c => t.cells.find(cell => cell.row === r.id && cell.column === c.id)?.text ?? ""));
const tables = (b) => b.objects.filter(o => o.type === "table");
const tableCentre = (t) => ({ x: t.x + t.width / 2, y: t.y + t.height / 2 });

test("X5-U01 detects spreadsheet data and CSV files without parsing HTML", async () => {
  const m = await csv();
  for (const [plain, html] of [["a\tb", ""], ["one", "<table>"], ["one\ntwo", '<TABLE class="sample">']]) {
    assert(m.isSpreadsheetData(plain, html));
  }
  for (const [plain, html] of [["", "<table>"], ["one\ntwo", ""], ["one", "<tablecloth>"], ["one", "<table/"], ["one", "&lt;table&gt;"]]) {
    assert(!m.isSpreadsheetData(plain, html));
  }
  assert(m.isCsvFile(file("SHEET.CsV", "")));
  assert(m.isCsvFile(file("", "", "text/csv")));
  assert(!m.isCsvFile(file("sheet.csv.jpg", "")));
});

test("X5-U02 reads both separators, padding, exact text, line breaks and one BOM", async () => {
  const m = await csv();
  assert.deepEqual(m.readSpreadsheet(SAMPLE).grid.rows, MATRIX);
  const text = '\uFEFF\uFEFFa,"b,c",9" pipe\r\n" a\r\nb\rc\n""d""\t",\'e,=x\rshort,\n\n';
  const item = await m.readCsvFile(file("sheet.CSV", text));
  assert.deepEqual(item.grid.rows, [
    ["\uFEFFa", "b,c", '9" pipe'], [' a\nb\nc\n"d"\t', "'e", "=x"], ["short", "", ""], ["", "", ""],
  ]);
  assert.deepEqual(m.readSpreadsheet('"a\tb"\t c \r\nx\t').grid.rows, [["a\tb", " c "], ["x", ""]]);
  assert.deepEqual(m.readSpreadsheet("x\t\ny\t\n").grid.rows, [["x", ""], ["y", ""]]);
  assert.deepEqual(m.readSpreadsheet("x\t\n\n").grid.rows, [["x", ""], ["", ""]]);
  assert.deepEqual((await m.readCsvFile(file("a.csv", "\uFEFFx,"))).grid.rows, [["x", ""]]);
});

test("X5-U03 refuses invalid input in the specified reading order", async () => {
  const m = await csv();
  const broken = () => { throw Error("unreadable"); };
  assert.equal((await m.readCsvFile({ ...file("photo.png", ""), size: LIMIT + 1, arrayBuffer: broken })).reason, "it is not a CSV file");
  assert.equal((await m.readCsvFile({ ...file("a.csv", ""), size: LIMIT + 1, arrayBuffer: broken })).reason, "the file is larger than 384 KiB");
  assert.equal((await m.readCsvFile({ ...file("a.csv", ""), arrayBuffer: broken })).reason, "the file could not be read");
  assert.equal((await m.readCsvFile(file("", [0x61, 0xff, 0x62], "text/csv"))).reason, "the file is not UTF-8 text");
  assert.equal((await m.readCsvFile(file("", [0x61, 0xff, 0x62], "text/csv"))).name, "Clipboard file");
  assert.equal(m.readSpreadsheet("🟦".repeat(LIMIT / 4) + "\t").reason, "the data is larger than 384 KiB");
  assert(!("reason" in m.readSpreadsheet(csvBlock(50, 20, () => "x").replaceAll(",", "\t"))));
  for (const [text, reason] of [
    ['a\tb\r\nc\t"d\re', "line 2 has a quote that is not closed"],
    ['"a\nb"x\t"next', "line 2 has text after a closing quote"],
    ['"a\r\nb"\t"c\n', "line 2 has a quote that is not closed"],
    ["\n".repeat(1000) + '"x', "line 1,001 has a quote that is not closed"],
    ["\t".repeat(20) + "\n".repeat(51), "it holds no text"],
    [Array(51).fill("x\t".repeat(20)).join("\n"), "a table holds at most 20 columns, and this data has 21"],
    [Array(51).fill("x").join("\n"), "a table holds at most 50 rows, and this data has 51"],
    ["\ud800\tok\nx\t" + "🟦".repeat(1001), "a cell holds up to 1,000 characters, and row 2, column 2 has 1,001"],
    ["ok\t\ud800\n\udc00\tx", "row 1, column 2 holds text a table cannot store"],
  ]) assert.equal(m.readSpreadsheet(text).reason, reason);
  assert.equal((await m.readCsvFile(file("wide.csv", "x,".repeat(20)))).reason, "a table holds at most 20 columns, and this file has 21");
  assert.equal((await m.readCsvFile(file("long.csv", "x\n".repeat(60)))).reason, "a table holds at most 50 rows, and this file has 60");
  assert(!("reason" in m.readSpreadsheet("🟦".repeat(1000) + "\t")));
});

test("X5-U04 formats paste, import and combined refusal notices in item order", async () => {
  const m = await csv(), b = await blank();
  const [a, nonCsv, empty, invalid, open] = await Promise.all([
    file("tasks.csv", "A,B"), file("photo.png", "A,B"), file("", "", "text/csv"),
    file("b.csv", [0xff]), file("c.csv", '"'),
  ].map(m.readCsvFile));
  const one = batch(m, b, [a, nonCsv]);
  assert.equal(one.success, "Added a 2 × 1 table from “tasks.csv”.");
  assert.equal(one.refusal, "Could not import “photo.png”: it is not a CSV file.");
  assert.equal(batch(m, b, [a, a]).success, "Added 2 tables.");
  const failures = batch(m, b, [empty, invalid, open, invalid, open]);
  assert.equal(failures.refusal,
    "Could not import “Clipboard file”, “b.csv” and “c.csv” and 2 more: it holds no text; the file is not UTF-8 text; line 1 has a quote that is not closed.");
  assert.equal(failures.board, b);
  assert.equal(batch(m, b, [m.readSpreadsheet('a\t"')]).refusal, "Could not paste the table: line 1 has a quote that is not closed.");
  assert.equal(batch(m, b, [m.readSpreadsheet(SAMPLE)]).success, "Added a 4 × 3 table.");
});

test("X5-U05 applies the accepted items’ byte, all-page cell and object budgets in order", async () => {
  const m = await csv(), r = await rules();
  let b = otherPage(await blank());
  const page = b.pages.at(-1).id;
  for (let i = 0; i < 4; i++) b = r.add(b, "table", 0, 0, page, { columns: 20, rows: 50 });
  const big = name => m.readCsvFile(file(name, csvBlock(50, 20, () => "x".repeat(220))));
  const [first, over, last] = await Promise.all([
    m.readCsvFile(file("tiny.csv", "x")), big("wide.csv"), m.readCsvFile(file("other.csv", "x,y")),
  ]);
  const later = await m.readCsvFile(file("later.csv", csvBlock(25, 20, () => "y".repeat(440))));
  assert(over.grid.bytes + later.grid.bytes > LIMIT);
  const result = batch(m, b, [first, over, later]);
  assert.equal(result.success, "Added 2 tables.");
  assert.equal(result.refusal, "Could not import “wide.csv”: a board holds at most 5,000 table cells, and this table would bring it to 5,001.");
  assert.deepEqual(result.ids.map(id => tableCentre(result.board.objects.find(o => o.id === id))), [{ x: 0, y: 0 }, { x: 24, y: 24 }]);
  const byteLimited = batch(m, await blank(), [over, { ...over, name: "second.csv" }, last]);
  assert.equal(byteLimited.ids.length, 2);
  assert.equal(byteLimited.refusal, "Could not import “second.csv”: the files together are larger than 384 KiB.");
  for (let i = b.objects.length; i < 249; i++) b = r.add(b, "sticky", 30, 40, page);
  const limited = batch(m, b, [first, last]);
  assert.equal(limited.ids.length, 1);
  assert.equal(limited.refusal, "Could not import “other.csv”: a board holds at most 250 objects.");
  assert.equal(limited.board.objects.length, 250);
});

test("X5-U06 checks canonical payload on all pages, including a blank title and earlier accepted tables", async () => {
  const m = await csv(), r = await rules();
  let b = otherPage(await blank());
  b = r.add(b, "table", 0, 0, b.pages.at(-1).id, { columns: 10, rows: 49 });
  b.objects[0] = fill(b.objects[0], Array.from({ length: 49 }, () => Array(10).fill("🟦".repeat(1000))));
  r.canonical(b);
  const medium = await m.readCsvFile(file("first.csv", csvBlock(10, 10, () => "a".repeat(450))));
  const withSecond = { ...medium, name: "second.csv" };
  const result = batch(m, { ...b, title: "" }, [medium, withSecond]);
  assert.equal(result.ids.length, 1);
  assert.equal(result.board.title, "");
  assert.equal(result.refusal, "Could not import “second.csv”: the board would be larger than 2 MiB.");
  const tooBig = batch(m, b, [await m.readCsvFile(file("large.csv", csvBlock(20, 20, () => "x".repeat(500))))]);
  assert.equal(tooBig.board, b);
  assert.equal(tooBig.refusal, "Could not import “large.csv”: the board would be larger than 2 MiB.");
});

test("X5-U07 estimates at least the adapter’s real encoded hosted edit and refuses over-budget proposals", async (t) => {
  const m = await csv();
  const [{ Adapter }, { encode }] = await Promise.all([
    import("../packages/board-sync/src/document-adapter.ts"), import("../packages/board-sync/src/session.ts"),
  ]);
  const full = csvBlock(50, 20, (r, c) => "x".repeat(r * 20 + c < 217 ? 393 : 392));
  assert.equal(encoder.encode(full).length, LIMIT);
  for (const [label, inputs, expectedAccepted] of [
    ["five dense tables", Array(5).fill(csvBlock(50, 20, () => "x".repeat(76))), 3],
    ["384 KiB table", [full], 1],
    ["5,000 single-character cells", Array(5).fill(csvBlock(50, 20, () => "é")), 5],
  ]) {
    const initial = await blank();
    const parsed = await Promise.all(inputs.map((text, i) => m.readCsvFile(file("table-" + i + ".csv", text))));
    assert(parsed.every(item => item.grid));
    const candidate = batch(m, initial, parsed);
    assert.equal(candidate.ids.length, inputs.length);
    const adapter = new Adapter();
    adapter.set(initial);
    const vector = Y.encodeStateVector(adapter.doc);
    adapter.set(candidate.board);
    const actual = encoder.encode(JSON.stringify({
      kind: "edit", epoch: 1, requestId: crypto.randomUUID(),
      update: encode(Y.encodeStateAsUpdate(adapter.doc, vector)), restoreGeneration: 0,
    })).length;
    adapter.destroy();
    const estimate = m.hostedEditEstimate(parsed.reduce((bytes, item) => bytes + item.grid.textBytes, 0), inputs.length * 1000);
    t.diagnostic(label + " — estimate " + estimate + " bytes, encoded edit " + actual + " bytes");
    assert(estimate >= actual, label + ": estimate " + estimate + " under real edit " + actual);
    assert.equal(actual > 1_048_576, label === "five dense tables");
    const allowed = batch(m, initial, parsed, true);
    assert.equal(allowed.ids.length, expectedAccepted);
    if (expectedAccepted !== inputs.length) {
      assert.equal(allowed.refusal, "Could not import “table-3.csv” and “table-4.csv”: the tables are too large to send in one edit.");
    }
  }
});

test("X5-U08 creates ordinary tables with fresh IDs, stored cells, grown rows, cascade and placement", async () => {
  const m = await csv(), r = await rules(), w = await webTables();
  const { placeObject } = await import("../apps/web/src/sections.ts");
  const { containerType } = await import("../packages/board-rules/src/objects/registry.ts");
  let b = otherPage(await blank());
  const page = b.pages.at(-1).id;
  b = r.add(b, containerType().type, 400, 450, page);
  b.objects[0] = { ...b.objects[0], x: -200, y: -200, width: 1600, height: 1600 };
  const source = m.readSpreadsheet('one\t\ntwo\t"line\nline"');
  const place = (t, centre) => {
    const grown = w.growTable(t, measure), drawn = w.layoutTable(grown, measure).box;
    return w.boundTable({ ...grown, x: centre.x - drawn.width / 2, y: centre.y - drawn.height / 2 }, drawn.height);
  };
  const result = m.addTableData(b, [source, source], anchor(b, 500.5, 400.5, page), false, place);
  const [first, second] = tables(result.board);
  assert.equal(first.page, page);
  assert.equal(first.section, b.objects[0].id);
  assert.deepEqual(result.board, placeObject(placeObject(b, first), second));
  assert.deepEqual(result.board.objects[0], b.objects[0]);
  assert.deepEqual(first.columns.map(c => c.width), [192, 192]);
  assert.deepEqual(first.rows.map(row => row.height), [64, 88]);
  assert.deepEqual(matrix(first), [["one", ""], ["two", "line\nline"]]);
  assert.equal(first.cells.length, 3);
  assert.equal(first.textSize, "medium");
  assert.deepEqual(tableCentre(first), { x: 501, y: 401 });
  assert.deepEqual(tableCentre(second), { x: 525, y: 425 });
  const ids = [first, second].flatMap(o => [o.id, o.generation, ...o.rows.map(r => r.id), ...o.columns.map(c => c.id)]);
  assert.equal(new Set(ids).size, ids.length);
  const tall = m.addTableData(b, [m.readSpreadsheet('x\t"' + "\n".repeat(60) + '"')], anchor(b, 0, 1e6, page), false, place);
  const [table] = tables(tall.board), { height } = w.layoutTable(table, measure).box;
  assert.equal(table.height, 1000);
  assert(height > table.height);
  assert.equal(table.y + height, 1e6);
});

test("X5-U09 writes TSV and BOM CSV with the exact text, formula, line-end and name rules", async () => {
  const m = await csv(), r = await rules();
  const cells = ["=SUM(1,2)", "+cmd", "-1.", "@x", "\tx", "\rx", "-5", "+3.2", ".5", "1e3", "-2.5E-3",
    "a,b", 'a"b', "a\nb", ""];
  const b = r.add(await blank(), "table", 0, 0, undefined, { columns: cells.length, rows: 2 });
  const table = fill(b.objects[0], [cells]);
  assert.equal(m.tableTsv(table), '=SUM(1,2)\t+cmd\t-1.\t@x\t"\tx"\t"\rx"\t-5\t+3.2\t.5\t1e3\t-2.5E-3\ta,b\t"a""b"\t"a\nb"\t\n' + "\t".repeat(14));
  const text = m.tableCsv(table);
  assert.deepEqual([...encoder.encode(text).subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.equal(text, "\uFEFF\"'=SUM(1,2)\",'+cmd,'-1.,'@x,'\tx,\"'\rx\",-5,+3.2,.5,1e3,-2.5E-3,\"a,b\",\"a\"\"b\",\"a\nb\",\r\n" + ",".repeat(14) + "\r\n");
  const exported = await m.readCsvFile(file("copy.csv", text));
  assert.deepEqual(exported.grid.rows, [
    ["'=SUM(1,2)", "'+cmd", "'-1.", "'@x", "'\tx", "'\nx", ...cells.slice(6)], Array(15).fill(""),
  ]);
  assert.equal(m.tableCsvName('A<>:"/\\|?*\u0000\u007f. '), "A____________ table.csv");
  for (const reserved of ["CON", "PrN.txt", "aux", "NUL.png", "Com0.doc", "COM9", "LPT0", "lpt9.xlsx"]) {
    assert.equal(m.tableCsvName(reserved), "_" + reserved + " table.csv");
  }
  assert.equal(m.tableCsvName(""), "Untitled board table.csv");
  assert.equal((await m.readCsvFile(file("empty.csv", m.tableCsv(b.objects[0])))).reason, "it holds no text");
  assert.equal((await m.readCsvFile(file("formula.csv", m.tableCsv(fill(b.objects[0], [["=" + "x".repeat(999)]]))))).reason,
    "a cell holds up to 1,000 characters, and row 1, column 1 has 1,001");
  const large = r.add(await blank(), "table", 0, 0, undefined, { columns: 20, rows: 50 }).objects[0];
  assert.equal((await m.readCsvFile(file("huge.csv", m.tableCsv(fill(large, Array(50).fill(Array(20).fill("x".repeat(400)))))))).reason,
    "the file is larger than 384 KiB");
});

test("X5-U10 preserves the object order for clipboard text and includes empty tables", async () => {
  await csv();
  const r = await rules(), { plainText } = await import("../apps/web/src/clipboard.ts");
  const table = fill(r.add(await blank(), "table", 0, 0).objects[0], [["a", "=b"], ["x", ""]]);
  const empty = { ...table, cells: [] };
  const before = { type: "sticky", text: "Before" }, after = { type: "text", text: "After" };
  assert.equal(plainText({ objects: [table] }), "a\t=b\nx\t");
  assert.equal(plainText({ objects: [before, table, after] }), "Before\n\na\t=b\nx\t\n\nAfter");
  assert.equal(plainText({ objects: [empty] }), "\t\n\t");
  assert.equal(plainText({ objects: [before, { ...empty, rows: empty.rows.slice(0, 1), columns: empty.columns.slice(0, 1) }, after] }),
    "Before\n\n\n\nAfter");
});

let compiled;
function webHarness() {
  return compiled ??= build({
    stdin: {
      contents: [
        'export { useEditingCommands } from "./state/use-editing-commands.ts";',
        'export { usePageKeys } from "./state/use-page-keys.ts";',
        'export { TableControls } from "./ui/table-controls.tsx";',
        'export { BoardPanel } from "./ui/board-panel.tsx";',
        'export { render } from "react";',
      ].join("\n"),
      resolveDir: new URL("../apps/web/src/", import.meta.url).pathname,
      loader: "ts",
    },
    bundle: true, write: false, platform: "node", format: "esm", jsx: "automatic",
    plugins: [{ name: "test-hooks", setup(plugin) {
      plugin.onResolve({ filter: /^react$/ }, () => ({ path: "hooks", namespace: "test" }));
      plugin.onResolve({ filter: /^react\/jsx(-dev)?-runtime$/ },
        ({ path }) => ({ path: import.meta.resolve(path), external: true }));
      plugin.onLoad({ filter: /.*/, namespace: "test" }, () => ({
        loader: "js",
        contents: [
          "let frame, cursor;",
          "export function render(slots, call) { frame = slots; cursor = 0; return call(); }",
          "export function useRef(initial) { const i = cursor++; return frame[i] ??= { current: initial }; }",
          "export function useState(initial) { const slot = useRef(initial); return [slot.current, next => {",
          '  slot.current = typeof next === "function" ? next(slot.current) : next;',
          "}]; }",
        ].join("\n"),
      }));
    } }],
  }).then(result => import("data:text/javascript;base64," + Buffer.from(result.outputFiles[0].text).toString("base64")));
}

function replaceProperty(t, obj, key, value) {
  const previous = Object.getOwnPropertyDescriptor(obj, key);
  Object.defineProperty(obj, key, { configurable: true, value });
  t.after(() => previous ? Object.defineProperty(obj, key, previous) : delete obj[key]);
}

class SyntheticElement {
  constructor(parent = null, text = false) { this.parent = parent; this.text = text; }
  contains(other) { return this === other || !!other.parent && this.contains(other.parent); }
  closest() { return this.text ? this : this.parent?.closest(); }
  getBoundingClientRect() { return { left: 100, top: 80, width: 1200, height: 800 }; }
}
function event(h, { files = [], text = "", html = "", target = h.surface, handled = false, point = [1000, 600] } = {}) {
  return {
    target, currentTarget: h.surface, defaultPrevented: handled, prevented: 0,
    clientX: point[0], clientY: point[1], dataTransfer: { files },
    clipboardData: { files, getData: kind => kind === "text/plain" ? text : html },
    preventDefault() { this.defaultPrevented = true; this.prevented++; },
  };
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function heldFile(name, text) {
  const gate = deferred();
  const ready = file(name, text);
  return { ...ready, arrayBuffer: () => gate.promise, finish: async () => gate.resolve(await ready.arrayBuffer()) };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
async function commandHarness(initial = undefined) {
  const board = initial ?? await blank(), hooks = await webHarness();
  const { emptyHistory, record } = await import("../apps/web/src/history.ts");
  const surface = new SyntheticElement(), slots = [], messages = [], commits = [], panels = [], tools = [], fallbacks = [];
  surface.clientWidth = 1200;
  surface.clientHeight = 800;
  surface.focusCount = 0;
  surface.focus = () => surface.focusCount++;
  const props = {
    model: { current: board }, scene: { current: surface }, historyRef: { current: emptyHistory() },
    pages: { id: board.boardId, afterHistory() {} }, view: { x: 13, y: 27, z: 2 },
    selected: new Set(), alive: { current: true }, messageSequence: { current: 0 },
    commandReason: "", selectionReason: "", clipboardState: { ...editable }, editingState: { ...editable },
    tableMeasure: measure, displayedObjects: board.objects,
    select(ids) { props.selected = new Set(typeof ids === "string" ? ids ? [ids] : [] : ids); },
    setMessage(message) { messages.push(message); props.messageSequence.current++; },
    setTool(tool) { tools.push(tool); }, setPanel(panel) { panels.push(panel); },
    setInline() {}, finishTextSession() {}, setDrafts() {},
    updateHistory(history) { props.historyRef.current = history; },
    commit(next, semantic) {
      commits.push([next, semantic]);
      if (semantic) props.updateHistory(record(props.historyRef.current, props.model.current, next));
      props.model.current = next;
    },
  };
  const h = { hooks, props, surface, messages, commits, panels, tools, fallbacks };
  h.render = () => hooks.render(slots, () => hooks.useEditingCommands(props));
  h.paste = (args) => h.render().tableData.paste(e => { fallbacks.push(["paste", e]); })(event(h, args));
  h.drop = (args) => h.render().tableData.drop(e => { fallbacks.push(["drop", e]); })(event(h, args));
  return h;
}

test("X5-U11 routes each paste and drop once, preserving native targets and file priority", async (t) => {
  await csv();
  replaceProperty(t, globalThis, "Element", SyntheticElement);
  const h = await commandHarness(), png = file("photo.png", ""), csvFile = file("tasks.csv", "a,b");
  const input = new SyntheticElement(h.surface, true), child = new SyntheticElement(h.surface);
  for (const [action, args] of [
    ["paste", { target: new SyntheticElement(), files: [csvFile] }], ["paste", { handled: true, files: [csvFile] }],
    ["paste", { files: [png], text: "a\tb" }], ["paste", { text: "ordinary" }],
    ["drop", { target: input, files: [csvFile] }], ["drop", { target: new SyntheticElement(), files: [csvFile] }],
    ["drop", { handled: true, files: [csvFile] }], ["drop", { files: [png] }],
  ]) {
    const prior = h.fallbacks.length;
    await h[action](args);
    assert.equal(h.fallbacks.length, prior + 1);
    assert.equal(h.fallbacks.at(-1)[0], action);
    assert.equal(h.fallbacks.at(-1)[1].prevented, 0);
  }
  assert.equal(h.commits.length, 0);
  await h.paste({ files: [png, csvFile], text: "ignored\ttext" });
  assert.equal(h.messages.at(-1), "Added a 2 × 1 table from “tasks.csv”. Could not import “photo.png”: it is not a CSV file.");
  assert.deepEqual(matrix(tables(h.props.model.current)[0]), [["a", "b"]]);
  assert.deepEqual(tableCentre(tables(h.props.model.current)[0]), { x: 13, y: 27 });
  await h.drop({ target: child, files: [csvFile] });
  assert.deepEqual(tableCentre(tables(h.props.model.current)[1]), { x: 163, y: 87 });
  await h.paste({ text: "x\ny", html: "<TABLE data-ignored>" });
  assert.deepEqual(matrix(tables(h.props.model.current)[2]), [["x"], ["y"]]);
  const e = event(h, { text: "1\t2" });
  h.render().tableData.paste(() => assert.fail("fallback after detection"))(e);
  assert.equal(e.prevented, 1);
  assert.equal(h.fallbacks.length, 8);
  assert.deepEqual([...h.props.selected], [tables(h.props.model.current)[3].id]);
  assert.equal(h.surface.focusCount, 4);
  assert.deepEqual(h.tools, Array(4).fill("Select"));
});

test("X5-U12 preserves each editing gate and the voting fallback and import visibility", async (t) => {
  await csv();
  replaceProperty(t, globalThis, "Element", SyntheticElement);
  const h = await commandHarness(), files = [file("data.csv", "a,b")];
  const states = [
    ["readOnly", "Read-only: editing commands are unavailable."],
    ["composing", "Finish text composition before using editing commands."],
    ["pointerGesture", "Finish or cancel the pointer gesture before using editing commands."],
    ["invalidObjectText", "Correct invalid drafts before using editing commands."],
    ["tidy", "Apply or cancel Tidy up first."],
  ];
  for (const [name, reason] of states) {
    h.props.clipboardState = { ...editable, [name]: true };
    h.props.selectionReason = name === "tidy" ? reason : "";
    const prior = h.fallbacks.length;
    h.paste({ text: "1\t2" });
    assert.equal(h.fallbacks.length, prior + 1);
    h.drop({ files });
    assert.equal(h.messages.at(-1), reason);
    h.paste({ files });
    assert.equal(h.messages.at(-1), reason);
    assert(h.render().tableData.importButton.disabled);
  }
  h.props.clipboardState = { ...editable };
  h.props.selectionReason = "";
  h.props.hosted = { canEdit: false, snapshot: { role: "editor" }, voting: { mode: false } };
  const importButton = () => h.render().tableData.importButton;
  assert(importButton().shown && importButton().disabled);
  h.props.hosted.history = { previewing: true };
  assert(importButton().shown && importButton().disabled);
  h.props.hosted.snapshot.role = "viewer";
  assert(!importButton().shown);
  h.props.hosted = { canEdit: true, snapshot: { role: "owner" }, voting: { mode: true } };
  const before = h.fallbacks.length;
  h.paste({ text: "x\ty" }); h.paste({ files }); h.drop({ files });
  assert.equal(h.fallbacks.length, before + 3);
  assert(importButton().shown && importButton().disabled);
  assert(h.render().tableData.exportTable.disabled);
  assert.equal(h.commits.length, 0);
  h.props.hosted.voting.mode = false;
  assert(importButton().shown && !importButton().disabled);
  h.props.hosted = undefined;
  h.paste({ text: "x\ty" });
  assert.equal(h.messages.at(-1), "Added a 2 × 1 table.");
});

test("X5-U13 distinguishes Board’s pending, written and refused copies across delayed writes", async (t) => {
  await csv();
  const r = await rules();
  let original = r.add(await blank(), "table", 0, 0);
  original = { ...original, objects: [fill(original.objects[0], [["a", "b"], ["c", "d"]])] };
  const h = await commandHarness(original), writes = [];
  replaceProperty(t, navigator, "clipboard", { writeText(text) {
    const write = deferred();
    writes.push({ text, ...write });
    return write.promise;
  } });
  const copy = () => {
    h.props.selected = new Set([original.objects[0].id]);
    h.render().clipboardCommand("Copy");
  };
  copy();
  assert.equal(writes[0].text, "a\tb\nc\td");
  h.paste({ text: writes[0].text });
  assert.equal(h.fallbacks.length, 1);
  copy();
  writes[0].reject(Error("late"));
  await tick();
  assert.equal(h.messages.at(-1), "Copied 1 object.");
  h.paste({ text: "other\tdata" });
  assert.equal(h.commits.length, 1);
  writes[1].reject(Error("denied"));
  await tick();
  h.paste({ text: "even\tnewer" });
  assert.equal(h.fallbacks.length, 2);
  copy();
  writes[2].resolve();
  await tick();
  h.paste({ text: writes[2].text });
  assert.equal(h.fallbacks.length, 3);
  h.paste({ text: "other\tnewer" });
  assert.equal(h.commits.length, 2);
  copy();
  writes[3].reject(Error("denied"));
  await tick();
  assert.equal(h.messages.at(-1), "Copied 1 object. Text could not be placed on the system clipboard.");
  h.paste({ text: "even\tnewer", files: [file("external.csv", "x,y")] });
  await tick();
  assert.equal(h.commits.length, 3);
});

test("X5-U14 commits one undoable batch on the live board at the original anchor", async (t) => {
  await csv();
  replaceProperty(t, globalThis, "Element", SyntheticElement);
  const r = await rules(), h = await commandHarness(), pending = heldFile("slow.csv", "a,b\nc,d");
  const result = h.drop({ files: [pending, file("more.csv", "x,y")] });
  const live = r.add(h.props.model.current, "sticky", -300, -200);
  h.props.model.current = live;
  h.props.view = { x: -150, y: -200, z: 0.5 };
  h.render();
  await pending.finish(); await result;
  assert.equal(h.commits.length, 1);
  assert.equal(h.commits[0][1], true);
  assert.equal(h.props.historyRef.current.past.length, 1);
  assert.deepEqual(h.props.model.current.objects.find(o => o.id === live.objects[0].id), live.objects[0]);
  const imported = tables(h.props.model.current);
  assert.deepEqual(imported.map(tableCentre), [{ x: 163, y: 87 }, { x: 187, y: 111 }]);
  assert.equal(h.messages.at(-1), "Added 2 tables.");
  h.render().command("Undo");
  assert.equal(tables(h.props.model.current).length, 0);
  h.render().command("Redo");
  const identity = o => [o.id, o.rows.map(r => r.id), o.columns.map(c => c.id)];
  assert.deepEqual(tables(h.props.model.current).map(identity), imported.map(identity));
});

test("X5-U15 rechecks board, page, mount and live editability and budgets after a file read", async () => {
  await csv();
  const r = await rules();
  for (const change of ["board", "page", "unmounted", "read-only", "voting"]) {
    const h = await commandHarness(otherPage(await blank())), slow = heldFile("data.csv", "a,b");
    const paste = h.paste({ files: [slow] });
    if (change === "board") h.props.model.current = await blank();
    if (change === "page") h.props.pages.id = h.props.model.current.pages.at(-1).id;
    if (change === "unmounted") h.props.alive.current = false;
    if (change === "read-only") h.props.clipboardState.readOnly = true;
    if (change === "voting") h.props.hosted = { canEdit: true, snapshot: { role: "editor" }, voting: { mode: true } };
    h.render();
    await slow.finish(); await paste;
    assert.equal(h.commits.length, 0, change);
    assert.deepEqual(h.messages, [], change);
  }

  const h = await commandHarness(), slow = heldFile("data.csv", "a,b");
  h.props.hosted = { canEdit: true, snapshot: { role: "editor" }, voting: { mode: false } };
  const paste = h.paste({ files: [slow] });
  for (let i = 0; i < 5; i++) {
    h.props.model.current = r.add(h.props.model.current, "table", 0, 0, undefined, { columns: 20, rows: 50 });
  }
  await slow.finish(); await paste;
  assert.equal(h.commits.length, 0);
  assert.equal(h.messages.at(-1), "Could not import “data.csv”: a board holds at most 5,000 table cells, and this table would bring it to 5,002.");

  const refused = await commandHarness();
  refused.props.commit = (next, semantic) => refused.commits.push([next, semantic]);
  await refused.paste({ files: [file("data.csv", "a,b")] });
  assert.equal(refused.commits.length, 1);
  assert.deepEqual(refused.messages, []);
  assert.equal(refused.props.selected.size, 0);
  assert.equal(refused.surface.focusCount, 0);
});

test("X5-U16 captures the chooser’s original view and closes the panel only after a nonempty choice", async (t) => {
  await csv();
  const h = await commandHarness(), fields = [];
  class Input extends EventTarget {
    click() { this.clicked = true; }
    remove() { this.removed = true; }
  }
  replaceProperty(t, globalThis, "document", { createElement: () => new Input(), body: { append: field => fields.push(field) } });
  const choose = () => h.render().tableData.importButton.choose();
  choose();
  assert.deepEqual([fields[0].type, fields[0].multiple, fields[0].accept, fields[0].hidden, fields[0].clicked],
    ["file", true, ".csv,text/csv", true, true]);
  fields[0].dispatchEvent(new Event("cancel"));
  assert(fields[0].removed);
  assert.deepEqual(h.panels, []);
  choose();
  h.props.view = { x: 0, y: 0, z: 1 };
  h.render();
  fields[1].files = [file("data.csv", "a,b"), file("empty.csv", "")];
  fields[1].dispatchEvent(new Event("change"));
  assert(fields[1].removed);
  assert.deepEqual(h.panels, [""]);
  await tick();
  assert.deepEqual(tableCentre(tables(h.props.model.current)[0]), { x: 13, y: 27 });
  assert.equal(h.messages.at(-1), "Added a 2 × 1 table from “data.csv”. Could not import “empty.csv”: it holds no text.");
  choose();
  fields[2].files = [file("oops.csv", '"')];
  fields[2].dispatchEvent(new Event("change"));
  await tick();
  assert.equal(h.panels.length, 3);
  assert.equal(h.messages.at(-1), "Could not import “oops.csv”: line 1 has a quote that is not closed.");
});

test("X5-U17 renders both new controls with their exact order, roles and platform text", async (t) => {
  const m = await csv(), hooks = await webHarness(), r = await rules();
  const table = r.add(await blank(), "table", 0, 0).objects[0];
  const controls = (props) => renderToStaticMarkup(createElement(hooks.TableControls, {
    table, selection: { kind: "table", id: table.id }, invalid: false, readOnly: false,
    composing: false, reason: "", children: createElement("button", {}, "Arrange"), ...props,
  }));
  replaceProperty(t, navigator, "platform", "MacIntel");
  const exportTable = () => true;
  const bar = controls({ exportTable });
  assert.match(bar, /aria-label="Add column".*aria-label="Export as CSV".*<button>Arrange/);
  assert.match(bar, /aria-label="Export as CSV"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"/);
  assert.match(bar, /class="tooltip">Export as CSV ⇧⌘E/);
  Object.defineProperty(navigator, "platform", { configurable: true, value: "Win32" });
  assert.match(controls({ exportTable }), /class="tooltip">Export as CSV Ctrl\+Shift\+E/);
  assert.doesNotMatch(controls({}), /Export as CSV/);
  assert.doesNotMatch(controls({ exportTable, readOnly: true }), /Export as CSV/);
  const blocked = Object.assign(exportTable, { disabled: true, reason: "Apply or cancel Tidy up first." });
  assert.match(controls({ exportTable: blocked }), /aria-label="Export as CSV" disabled="".*class="tooltip">Apply or cancel Tidy up first\./);
  assert.equal(m.tableCsvName("CSV check"), "CSV check table.csv");

  const panel = (importTable, team) => renderToStaticMarkup(createElement(hooks.BoardPanel, {
    title: "CSV check", importTable, boardFiles: { entries: [], heldLocks: [] }, team,
  }));
  assert.match(panel({ shown: true }), /Save a copy to file.*Open board file….*<button>Import CSV…<\/button><\/div>.*Reopen/);
  assert.match(panel({ shown: true, disabled: true }, { hosted: { snapshot: {}, history: {} } }),
    /Save a copy to file.*<button disabled="">Import CSV…<\/button><\/div>.*Show version history/);
  assert.doesNotMatch(panel({ shown: false }, { hosted: { snapshot: {}, history: {} } }), /Import CSV…/);
});

test("X5-U18 shares the export gate with the exact canvas shortcut and leaves board state alone", async (t) => {
  const m = await csv(), r = await rules();
  replaceProperty(t, globalThis, "Element", SyntheticElement);
  replaceProperty(t, navigator, "platform", "MacIntel");
  const b = r.add(await blank(), "table", 0, 0, undefined, { columns: 20, rows: 50 }), h = await commandHarness(b);
  const [table] = b.objects;
  h.props.selected = new Set([table.id]);
  h.props.clipboardState.invalidObjectText = true;
  h.props.selectionReason = "Correct invalid drafts before using editing commands.";
  const links = [], blobs = [], revoked = [];
  replaceProperty(t, globalThis, "document", { createElement(tag) {
    assert.equal(tag, "a"); return { click() { links.push(this); } };
  } });
  replaceProperty(t, URL, "createObjectURL", blob => { blobs.push(blob); return "blob:table"; });
  replaceProperty(t, URL, "revokeObjectURL", url => revoked.push(url));
  const controls = () => h.render().tableData.exportTable;
  const key = (extras = {}) => {
    const e = { key: "E", target: h.surface, nativeEvent: {}, shiftKey: true, metaKey: true, ctrlKey: false,
      altKey: false, prevented: 0, preventDefault() { this.prevented++; }, ...extras };
    h.hooks.usePageKeys({ ...h.props, voting: h.props.hosted?.voting, exportTable: controls() }).pageKeyDown(e);
    return e.prevented;
  };
  assert(!controls().disabled);
  assert.equal(key(), 1);
  assert.equal(key({ key: "e" }), 1);
  assert.equal(key({ target: new SyntheticElement(h.surface) }), 0);
  assert.equal(key({ target: new SyntheticElement(h.surface, true) }), 0);
  assert.equal(key({ ctrlKey: true }), 0);
  assert.equal(key({ metaKey: false, ctrlKey: true }), 0);
  assert.equal(key({ altKey: true }), 0);
  assert.equal(key({ shiftKey: false }), 0);
  assert.equal(key({ nativeEvent: { isComposing: true } }), 0);
  assert.equal(links.length, 2);
  assert.equal(links[0].download, "CSV check table.csv");
  assert.equal(blobs[0].type, "text/csv;charset=utf-8");
  assert.deepEqual(new Uint8Array(await blobs[0].arrayBuffer()), encoder.encode(m.tableCsv(table)));
  h.props.selected = new Set();
  assert.equal(key(), 0);
  h.props.selected = new Set([table.id, "extra"]);
  assert.equal(key(), 0);
  h.props.selected = new Set([table.id]);
  for (const state of ["readOnly", "composing", "pointerGesture"]) {
    h.props.clipboardState = { ...editable, [state]: true };
    assert(controls().disabled);
    assert.equal(key(), 0);
  }
  h.props.clipboardState = { ...editable };
  h.props.selectionReason = "Apply or cancel Tidy up first.";
  assert.equal(key(), 0);
  h.props.selectionReason = "";
  h.props.hosted = { canEdit: true, snapshot: { role: "editor" }, voting: { mode: true } };
  assert.equal(key(), 0);
  h.props.hosted.voting.mode = false;
  Object.defineProperty(navigator, "platform", { configurable: true, value: "Linux" });
  assert.equal(key(), 0);
  assert.equal(key({ ctrlKey: true, metaKey: false }), 1);
  h.props.hosted.snapshot.role = "viewer";
  h.props.hosted.canEdit = false;
  assert.equal(key({ ctrlKey: true, metaKey: false }), 0);
  assert.equal(h.props.model.current, b);
  assert.deepEqual(h.commits, []);
  assert.deepEqual(h.messages, []);
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.deepEqual(revoked, Array(3).fill("blob:table"));
});

test("X5-U19 imports spreadsheet text and CSV files from nested canvas targets while preserving field paste", async (t) => {
  await csv();
  replaceProperty(t, globalThis, "Element", SyntheticElement);
  const h = await commandHarness();
  const status = new SyntheticElement(h.surface), textarea = new SyntheticElement(h.surface, true);
  const text = "a\tb\nc\td";
  const paste = (e) => h.render().tableData.paste(fallback => { h.fallbacks.push(fallback); })(e);

  const sheetPaste = event(h, { target: status, text });
  await paste(sheetPaste);
  assert.deepEqual(tables(h.props.model.current).map(matrix), [[["a", "b"], ["c", "d"]]]);
  assert.equal(sheetPaste.prevented, 1);

  const fieldPaste = event(h, { target: textarea, text });
  await paste(fieldPaste);
  assert.equal(h.fallbacks.length, 1);
  assert.equal(h.fallbacks[0], fieldPaste);
  assert.equal(fieldPaste.prevented, 0);
  assert.equal(h.commits.length, 1);

  const filePaste = event(h, { target: status, files: [file("nested.csv", "e,f")] });
  await paste(filePaste);
  assert.deepEqual(tables(h.props.model.current).map(matrix), [[["a", "b"], ["c", "d"]], [["e", "f"]]]);
  assert.equal(filePaste.prevented, 1);
  assert.equal(h.messages.at(-1), "Added a 2 × 1 table from “nested.csv”.");
  assert.equal(h.fallbacks.length, 1);
});
