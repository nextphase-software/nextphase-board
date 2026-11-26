// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const exporter = () => import("../apps/web/src/board-export.ts");
const csv = () => import("../apps/web/src/table-csv.ts");
const documentRules = () => import("../packages/board-rules/src/document.ts");
const drawn = (o, height = o.height) => ({ ...o, displayHeight: height });
const noop = () => {};
const choice = (rules, overrides) => ({ ...rules.defaultExportChoices, ...overrides });

async function fixture() {
  const { empty, add } = await documentRules();
  const board = ["section", "sticky", "sticky", "table", "table", "text", "shape", "mindNode"]
    .reduce((b, type, index) => add(b, type, index * 128, 0), { ...empty(), title: "Plan 🎨" });
  const [section, first, second, table, another, text, shape, root] = board.objects;
  first.section = table.section = section.id;
  first.text = "Café, naïve";
  first.marks = [{ from: 0, to: 2, bold: true }];
  second.text = "=1+1";
  table.cells = [{ row: table.rows[0].id, column: table.columns[0].id, text: "Name" },
    { row: table.rows[1].id, column: table.columns[1].id, text: 'Say "hi", ok' }];
  return { board, section, first, second, table, another, text, shape, root };
}

const pixelSize = { width: 2192, height: 992 };
function jpeg({ width, height } = pixelSize, marker = 0xc0, precision = 8, components = 3) {
  return Uint8Array.of(0xff, 0xd8, 0xff, 0xe0, 0, 6, 0xff, 0xc3, 0, 2,
    0xff, 0xff, marker, 0, 8 + 3 * components, precision, height >> 8, height & 255, width >> 8, width & 255,
    components, ...Array.from({ length: components }, (_, i) => [i + 1, 0x11, 0]).flat(), 0xff, 0xd9);
}

test("X6-U01 export defaults, format groups and commit-only choice memory", async () => {
  const rules = await exporter();
  assert.deepEqual(rules.defaultExportChoices, {
    type: "PNG", pngBackground: "Solid", jpgBackground: "Solid", jpgQuality: "High",
    pdfQuality: "Medium", csvType: "Tables", area: "Selection only",
  });
  assert.deepEqual(rules.exportGroups, {
    PNG: { background: "pngBackground" },
    JPG: { quality: "jpgQuality", background: "jpgBackground", disabledBackground: "Transparent" },
    PDF: { quality: "pdfQuality", white: true },
    CSV: { content: "csvType" },
  });
  const before = rules.defaultExportChoices;
  const changed = choice(rules, {
    type: "JPG", jpgBackground: "Grid", jpgQuality: "Low", pngBackground: "Transparent",
    pdfQuality: "High", csvType: "Stickies", area: "Entire page",
  });
  assert.deepEqual(rules.rememberExport(before, changed, true), choice(rules, {
    type: "JPG", jpgBackground: "Grid", jpgQuality: "Low", area: "Entire page",
  }));
  assert.equal(rules.rememberExport(before, changed, false).area, "Selection only");
  for (const [type, key] of [["PNG", "pngBackground"], ["PDF", "pdfQuality"], ["CSV", "csvType"]]) {
    assert.deepEqual(rules.rememberExport(before, { ...changed, type }, false), { ...before, type, [key]: changed[key] });
  }
});

test("X6-U02 selection, section members, hidden branches and whole tables across pages", async () => {
  const rules = await exporter();
  const { board, section, first, second, table, another, shape, root } = await fixture();
  const { hiddenIds } = await import("../apps/web/src/mind-map.ts");
  const extra = [
    { ...root, id: "folded", parent: root.id, side: "left", collapsed: true },
    { ...root, id: "hidden", parent: "folded", side: null },
    { ...shape, id: "elsewhere", page: "other-page" },
    { ...shape, id: "connector", type: "connector", section: null },
    { ...shape, id: "stroke", type: "stroke" },
    { ...shape, id: "tape", type: "tape" },
    { ...shape, id: "image", type: "image" },
  ];
  const all = [...board.objects, ...extra];
  const hidden = hiddenIds(all);
  assert(hidden.has("hidden"));
  const drawnObjects = all.filter(o => !hidden.has(o.id)).map(o => drawn(o));
  const selection = new Set([section.id, second.id, "hidden", "elsewhere", "connector"]);
  const selected = rules.includedObjects(drawnObjects, board.boardId, "Selection only", selection);
  assert.deepEqual(selected.map(o => o.id), [section.id, first.id, second.id, table.id, "connector"]);
  assert.deepEqual(rules.exportStickies(selected).map(o => o.id), [first.id, second.id]);
  assert.deepEqual(rules.wholeTables(selected, "Selection only", { kind: "table", id: table.id }).map(o => o.id), [table.id]);
  const page = rules.includedObjects(drawnObjects, board.boardId, "Entire page", new Set());
  assert.deepEqual(page.map(o => o.id), all.filter(o => o.id !== "elsewhere" && o.id !== "hidden").map(o => o.id));
  for (const kind of ["cell", "row", "column"]) {
    assert.deepEqual(rules.wholeTables(selected, "Selection only", { kind, id: table.id }), []);
    assert.deepEqual(rules.wholeTables(page, "Entire page", { kind, id: table.id }).map(o => o.id), [table.id, another.id]);
  }
  for (const o of page) {
    if (o.id === section.id) continue;
    assert.deepEqual(rules.includedObjects(drawnObjects, board.boardId, "Selection only", new Set([o.id])), [o]);
  }
});

test("X6-U03 drawn bounds, margin, round-up, limits, quarter steps, and scale notices", async () => {
  const r = await exporter(), { first, table, shape } = await fixture();
  const connector = { ...shape, type: "connector", x: -20.5, y: -10, width: 100, height: 0 };
  const box = r.pictureBox([drawn(first), drawn(table, 950), drawn(connector)]);
  assert.deepEqual(box, { x: -148.5, y: -248, width: table.x + table.width + 276.5, height: 1326 });
  assert.equal(r.pictureBox([]), null);
  const fit = (width, height, requested = 2) => r.fitPicture({ x: 0, y: 0, width, height }, requested);
  const expected = (scale, width, height) => ({ scale, pixels: { width, height } });
  assert.deepEqual(fit(256.25, 257.24), expected(2, 513, 514));
  assert.deepEqual(fit(8192, 8192), expected(2, 16384, 16384));
  assert.deepEqual(fit(8192.25, 8192), expected(1.75, 14336, 14336));
  assert.deepEqual(fit(8192, 8192.25), expected(1.75, 14336, 14336));
  assert.deepEqual(fit(10_000, 1000, 3), expected(1.5, 15000, 1500));
  assert.deepEqual(fit(20_000, 200, 1), expected(0.75, 15000, 150));
  assert.deepEqual(fit(32_768, 32_768), expected(0.5, 16384, 16384));
  assert.equal(fit(32_769, 500), undefined);
  assert.equal(r.lowerScaleMessage("Entire page", 1.5, 2), "Exported at 1.5× because the page is too large for 2×.");
  assert.equal(r.lowerScaleMessage("Selection only", 0.75, 3), "Exported at 0.75× because the selection is too large for 3×.");
});

test("X6-U04 grid centres are board-anchored and include boundary dots", async () => {
  const r = await exporter();
  assert.equal(r.gridRadius, 1);
  assert.deepEqual([...r.gridDots({ x: -17, y: -16, width: 49, height: 31.9 })],
    [-16, 0].flatMap(y => [-16, 0, 16, 32].map(x => ({ x, y }))));
  assert.deepEqual([...r.gridDots({ x: 0.1, y: 0.1, width: 1, height: 1 })], []);
});

test("X6-U05 JPEG frame recognizes C0, C1 and C2 and rejects mismatched or malformed frames", async () => {
  const { validJpegFrame } = await exporter();
  const valid = (bytes, type = "image/jpeg", size = pixelSize) => validJpegFrame(type, bytes, size);
  for (const marker of [0xc0, 0xc1, 0xc2]) assert(valid(jpeg(pixelSize, marker)));
  assert(!valid(jpeg(), "image/png"));
  assert(!valid(jpeg(), "image/jpeg", { ...pixelSize, height: 993 }));
  assert(!valid(jpeg(), "image/jpeg", { ...pixelSize, width: 2193 }));
  assert(!valid(jpeg(pixelSize, 0xc3)));
  assert(!valid(jpeg(pixelSize, 0xc0, 12)));
  assert(!valid(jpeg(pixelSize, 0xc0, 8, 1)));
  assert(!valid(jpeg(pixelSize, 0xc0, 8, 4)));
  assert(!valid(jpeg().subarray(1)));
  assert(!valid(jpeg().subarray(0, -3)));
  const laterFrame = Uint8Array.of(...jpeg(pixelSize, 0xc3).subarray(0, -2), ...jpeg().subarray(10));
  assert(!valid(laterFrame));
});

test("X6-U06 PDF bytes, page rounding and cap, Unicode title and byte offsets", async () => {
  const { pdfBytes } = await exporter();
  const image = Buffer.from(jpeg());
  const make = (width, height, title = "Café (🎨)") => Buffer.from(pdfBytes(image, pixelSize, { x: 0, y: 0, width, height }, title));
  const pdf = make(1096.005, 496.5);
  const header = Buffer.from([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 226, 227, 207, 211, 10]);
  const content = "q 1096.01 0 0 496.5 0 0 cm /Im0 Do Q";
  const strings = [
    "<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1096.01 496.5] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>\nendobj\n",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`,
    `<< /Type /XObject /Subtype /Image /Width 2192 /Height 992 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n` +
      image.toString("latin1") + "\nendstream\nendobj\n",
    "<< /Producer (NextPhase Board) /Title <FEFF00430061006600E900200028D83CDFA80029> >>\nendobj\n",
  ];
  let offset = header.length;
  const entries = strings.map((body, i) => {
    const prefix = `${i + 1} 0 obj\n`;
    assert.equal(pdf.subarray(offset, offset + prefix.length).toString(), prefix);
    const entry = `${String(offset).padStart(10, "0")} 00000 n \n`;
    assert.equal(entry.length, 20);
    offset += prefix.length + body.length;
    return entry;
  });
  assert.equal(pdf.subarray(offset, offset + 5).toString(), "xref\n");
  assert.deepEqual(pdf, Buffer.concat([header, Buffer.from(strings.map((body, i) => `${i + 1} 0 obj\n${body}`).join(""), "latin1"),
    Buffer.from("xref\n0 7\n0000000000 65535 f \n" + entries.join("") +
      `trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${offset}\n%%EOF\n`)]));
  for (const [w, h, pw, ph] of [[28800, 1000, 14400, 500], [257, 16000, 231.3, 14400], [14400, 256, 14400, 256]]) {
    const bytes = make(w, h, "").toString("latin1");
    assert(bytes.includes(`/MediaBox [0 0 ${pw} ${ph}]`));
    assert(bytes.includes(`q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`));
    assert(bytes.includes(image.toString("latin1")));
    assert(bytes.includes("/Title <FEFF>"));
  }
});

test("X6-U07 CSV bytes reuse the table export and include empty stickies in object order", async () => {
  const r = await exporter(), { csvField, tableCsv, tableCsvBody } = await csv();
  const { table, another, first, second } = await fixture();
  const body = 'Name,\r\n,"Say ""hi"", ok"\r\n';
  assert.equal(tableCsvBody(table), body);
  assert.equal(tableCsv(table), "\uFEFF" + body);
  assert.equal(r.tablesCsv([table]), tableCsv(table));
  assert.equal(r.tablesCsv([table, another]), "\uFEFF" + body + "\r\n,\r\n,\r\n");
  assert.equal(r.stickiesCsv([first, second, { text: "" }, { text: 'A\n"B"' }]),
    "\uFEFFContent\r\n\"Café, naïve\"\r\n'=1+1\r\n\r\n\"A\n\"\"B\"\"\"\r\n");
  assert.equal(csvField("-1.2e+5"), "-1.2e+5");
  assert.equal(csvField("@x"), "'@x");
  assert.equal(csvField("\t=1"), "'\t=1");
  assert.equal(csvField("\r=1"), '"\'\r=1"');
});

test("X6-U08 names match board-file sanitization, including all controls and device names", async () => {
  const { exportFileName } = await exporter();
  assert.equal(exportFileName('A<>:"/\\|?*' + String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i), 127) + ". ", "PNG"),
    "A" + "_".repeat(43) + ".png");
  for (const title of ["CON", "PrN.txt", "aux", "NUL.png", "Com0.doc", "COM9", "LPT0", "lpt9.xlsx"]) {
    assert.equal(exportFileName(title, "CSV"), "_" + title + ".csv");
  }
  assert.equal(exportFileName("", "PDF"), "Untitled board.pdf");
  assert.equal(exportFileName("Café 🎨", "JPG"), "Café 🎨.jpg");
});

let compiled;
function harnessModules() {
  return compiled ??= build({
    stdin: {
      contents: [
        'export { useExport } from "./state/use-export.ts";',
        'export { usePageKeys } from "./state/use-page-keys.ts";',
        'export { useFind } from "./state/use-find.ts";',
        'export { usePresence } from "./state/use-presence.ts";',
        'export { SpotlightLayer } from "./team/spotlight-layer.tsx";',
        'export { ReactionTool, ReactionsLayer } from "./team/reactions-layer.tsx";',
        'export { CommentsLayer } from "./team/comments/layer.tsx";',
        'export { ExportDialog } from "./ui/export-dialog.tsx";',
        'export { BoardPanel } from "./ui/board-panel.tsx";',
        'export { TableControls } from "./ui/table-controls.tsx";',
        'export { drawExport } from "./scene/export-drawing.tsx";',
        'export { BoardDrawing } from "./scene/board-drawing.tsx";',
        'export { MindMapLayer } from "./scene/mind-map-layer.tsx";',
        'export { render, effects } from "react";',
      ].join("\n"),
      resolveDir: new URL("../apps/web/src/", import.meta.url).pathname,
      loader: "ts",
    },
    bundle: true, write: false, platform: "node", format: "esm", jsx: "automatic",
    define: { BOARD_TEAM_FEATURES: "false", BOARD_TEAM_SETTINGS: '{"serverUrl":"","supabaseUrl":"","anonKey":""}' },
    plugins: [{ name: "export-harness", setup(plugin) {
      const shims = {
        react: `
          let frame, cursor;
          export const effects = [];
          export function render(slots, callback) { frame = slots; cursor = 0; effects.length = 0; return callback(); }
          export function useRef(initial) { const i = cursor++; return frame[i] ??= { current: initial }; }
          export function useState(initial) {
            const i = cursor++;
            const slot = frame[i] ??= { current: typeof initial === "function" ? initial() : initial };
            return [slot.current, next => { slot.current = typeof next === "function" ? next(slot.current) : next; }];
          }
          export const useEffect = callback => effects.push(callback);
          export const useLayoutEffect = useEffect;
          export const useCallback = callback => callback;
          export const useMemo = callback => callback();
          export const useSyncExternalStore = (_subscribe, get) => get?.();
        `,
        "react-dom": `
          export function flushSync(callback) {
            globalThis.exportHarness?.beforeFlush?.();
            const result = callback();
            globalThis.exportHarness?.afterFlush?.();
            return result;
          }
          export function createPortal(child) { return child; }
        `,
        "react-dom/client": "export const createRoot = host => globalThis.exportHarness.createRoot(host);",
        "react-konva": "export const Stage = 'Stage', Layer = 'Layer', Group = 'Group', Rect = 'Rect', Line = 'Line', Text = 'Text', Path = 'Path', Circle = 'Circle', Ellipse = 'Ellipse', Image = 'Image';",
      };
      plugin.onResolve({ filter: /^(react|react-dom|react-dom\/client|react-konva)$/ },
        ({ path }) => ({ path, namespace: "test" }));
      plugin.onResolve({ filter: /^react\/jsx(-dev)?-runtime$/ },
        ({ path }) => ({ path: import.meta.resolve(path), external: true }));
      plugin.onLoad({ filter: /.*/, namespace: "test" }, ({ path }) => ({ contents: shims[path], loader: "js" }));
    } }],
  }).then(result => import("data:text/javascript;base64," + Buffer.from(result.outputFiles[0].text).toString("base64")));
}

function replace(t, object, key, value) {
  const previous = Object.getOwnPropertyDescriptor(object, key);
  Object.defineProperty(object, key, { configurable: true, writable: true, value });
  t.after(() => previous ? Object.defineProperty(object, key, previous) : delete object[key]);
}

class Target {
  isConnected = true;
  constructor(selectors = [], onFocus = noop) { this.selectors = selectors; this.onFocus = onFocus; }
  closest(selector) { return selector.split(",").some(part => this.selectors.includes(part.trim())) ? this : null; }
  querySelector() { return this.inline ? new Target() : null; }
  focus() { this.onFocus(); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100 }; }
  addEventListener() {}
  removeEventListener() {}
}
class Radio extends Target { type = "radio"; }
class Button extends Target {}

function key(target, name, overrides = {}) {
  return {
    target, key: name, nativeEvent: {}, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false,
    prevented: 0, stopped: 0, preventDefault() { this.prevented++; }, stopPropagation() { this.stopped++; },
    stopImmediatePropagation() { this.stopped++; }, ...overrides,
  };
}

const hosted = (role, options = {}) => ({
  boardId: "hosted-board", snapshot: { role }, history: {}, voting: {}, ...options,
});
const view = { x: 0, y: 0, z: 1 };
const size = { w: 100, h: 100 };

function hook(t, m, board, options = {}) {
  const slots = [], notices = [], panels = [], focus = [], requests = [], draws = [], fills = [], blits = [], links = [], blobs = [], revoked = [];
  const canvas = new Target([], () => focus.push(["canvas", !!current.dialog.choices]));
  const button = new Button([], () => focus.push(["board", !!current.dialog.choices]));
  const props = {
    page: board.boardId, board, objects: board.objects.map(o => drawn(o)), objectLayouts: new Map(),
    selected: new Set(), bitmaps: new Map(), busy: false, composing: false, tidyOpen: false,
    draw: input => { draws.push(input); return { width: input.fit.pixels.width, height: input.fit.pixels.height }; },
    scene: { current: canvas }, boardButton: { current: button },
    setPanel: panel => panels.push(panel), setMessage: message => notices.push(message), ...options,
  };
  let current;
  const render = () => current = m.render(slots, () => m.useExport({ ...props }));
  const change = (k, value) => { current.dialog.change(k, value); render(); };
  const open = () => { const result = current.open(); render(); return result; };
  const run = () => { const done = current.dialog.run(); render(); return done; };
  const close = () => { current.dialog.close(); render(); };
  const toBlob = (callback, type, quality, dimensions) => {
    requests.push({ type, quality, dimensions });
    callback(new Blob([type === "image/jpeg" ? jpeg(dimensions) : "synthetic PNG"], { type }));
  };
  const env = { toBlob };
  replace(t, globalThis, "exportHarness", { afterFlush: render });
  replace(t, globalThis, "document", { createElement(tag) {
    if (tag === "a") return { click() { links.push(this); } };
    assert.equal(tag, "canvas");
    const context = {
      fillRect(...args) { fills.push([this.fillStyle, ...args]); },
      drawImage(image, ...args) { blits.push([image.width, image.height, ...args]); },
    };
    return {
      getContext: () => context,
      toBlob(callback, mime, quality) { env.toBlob(callback, mime, quality, { width: this.width, height: this.height }); },
    };
  } });
  replace(t, URL, "createObjectURL", blob => { blobs.push(blob); return `blob:export-${blobs.length}`; });
  replace(t, URL, "revokeObjectURL", url => revoked.push(url));
  render();
  return { props, canvas, button, focus, env, draws, fills, blits, links, blobs, revoked, requests, notices, panels,
    open, run, close, render, change, get current() { return current; } };
}

function begin(h, type, settings = {}) {
  assert.equal(h.open(), true);
  h.change("type", type);
  for (const [key, value] of Object.entries(settings)) h.change(key, value);
}

const tick = () => new Promise(resolve => setTimeout(resolve, 5));

test("X6-U09 the drawing uses its detached root synchronously and cleans up through failures", async (t) => {
  const r = await exporter(), m = await harnessModules(), { board, first } = await fixture();
  const box = r.pictureBox([drawn(first)]), fit = r.fitPicture(box, 2);
  const only = new Set([first.id]), objectLayouts = new Map(), bitmaps = new Map();
  const drawing = { board, only, objectLayouts, bitmaps, box, fit };
  const output = {}, events = [];
  let fail = false, inFlush = false, mounted;
  replace(t, globalThis, "document", { createElement(tag) {
    assert.equal(tag, "div");
    return { isConnected: false, remove() { events.push("remove"); } };
  } });
  replace(t, globalThis, "exportHarness", {
    beforeFlush() { inFlush = true; },
    afterFlush() { inFlush = false; },
    createRoot(host) {
      assert.equal(host.isConnected, false);
      return {
        render(element) {
          assert(inFlush);
          assert.equal(element.type, m.BoardDrawing);
          mounted = element.props;
          mounted.stageRef.current = { toCanvas(options) {
            assert(!inFlush);
            events.push(options);
            if (fail) throw Error("canvas failure");
            return output;
          } };
        },
        unmount() { events.push("unmount"); },
      };
    },
  });
  assert.equal(m.drawExport(drawing), output);
  const { stageRef, ...props } = mounted;
  assert(stageRef.current);
  assert.deepEqual(props, {
    board, only, objectLayouts, bitmaps, selected: new Set(), inline: false, faded: new Set(),
    pixelScale: fit.scale,
    tableGesture: { ghost: null }, preview: null, movingIds: [],
    size: { w: 2, h: 2 }, view: { x: box.x + 1, y: box.y + 1, z: 1 },
  });
  const options = { x: 0, y: 0, width: fit.pixels.width / 2, height: fit.pixels.height / 2, pixelRatio: 2 };
  assert.deepEqual(events, [options, "unmount", "remove"]);
  fail = true;
  assert.throws(() => m.drawExport(drawing), /canvas failure/);
  assert.deepEqual(events.slice(3), [options, "unmount", "remove"]);
});

const elements = (node) => Array.isArray(node) ? node.flatMap(elements) :
  node && typeof node === "object" ? [node, ...elements(node.props?.children)] : [];

test("X6-U10 filtered drawing retains whole-page connector layouts and the left branch side", async () => {
  await exporter();
  const m = await harnessModules(), { board: fixtureBoard, first, root, shape } = await fixture();
  const parent = { ...root, id: "left", x: -200, y: 0, parent: root.id, side: "left" };
  const child = { ...root, id: "left-child", x: -400, y: 40, parent: parent.id, side: null };
  const peer = { ...root, id: "right", x: 400, parent: root.id, side: "right" };
  const connector = { ...shape, id: "bridge", type: "connector", from: { object: first.id }, to: { object: shape.id } };
  const board = { ...fixtureBoard, objects: [root, parent, child, peer, first, shape, connector] };
  const only = new Set([parent.id, child.id, first.id, connector.id]), selected = new Set();
  const connectorLayout = { bounds: { x: 0, y: 0, width: 15, height: 20 } };
  const objectLayouts = new Map(board.objects.map(o => [o.id, { height: o.height, connector: connectorLayout }]));
  const drawing = m.BoardDrawing({ board, view, size, objectLayouts, selected, only, inline: false,
    tableGesture: { ghost: null }, faded: new Set(), bitmaps: new Map(), preview: null, movingIds: [] });
  const nodes = elements(drawing);
  const parts = nodes.filter(e => e.props.object || e.props.o);
  assert.deepEqual(new Set(parts.map(e => (e.props.object ?? e.props.o).id)), only);
  assert(parts.filter(e => e.props.object === connector).every(e => e.props.layout === connectorLayout));
  const map = nodes.find(e => e.type === m.MindMapLayer && e.props.pass === "lines");
  assert.equal(map.props.objects, board.objects);
  assert.equal(map.props.only, only);
  const links = elements(m.MindMapLayer(map.props)).filter(e => e.type === "Line");
  assert.equal(links.length, 1);
  assert.equal(links[0].key, child.id);
  assert.equal(links[0].props.points[0], parent.x);
  assert.equal(links[0].props.points.at(-2), child.x + child.width);
  assert.equal(elements(m.MindMapLayer({ ...map.props, only: undefined })).filter(e => e.type === "Line").length, 3);
});

test("X6-U11 opening gates and exact keys in local and hosted board views", async (t) => {
  const r = await exporter(), m = await harnessModules(), { board } = await fixture();
  const h = hook(t, m, board);
  replace(t, globalThis, "Element", Target);
  replace(t, navigator, "platform", "MacIntel");
  const shortcut = (overrides, original = h.canvas) => {
    const event = key(original, "E", { shiftKey: true, metaKey: true, ...overrides });
    m.usePageKeys({ ...h.props, voting: h.props.hosted?.voting, openExport: h.current.open }).pageKeyDown(event);
    h.render();
    return event.prevented;
  };
  const viewer = hosted("viewer", { online: false });
  h.props.hosted = viewer;
  for (const [label, value, set] of [
    ["voting", true, v => { viewer.voting.mode = v; }],
    ["gesture or import", true, v => { h.props.busy = v; }],
    ["composition", true, v => { h.props.composing = v; }],
    ["inline", true, v => { h.canvas.inline = v; }],
    ["tidy", true, v => { h.props.tidyOpen = v; }],
    ["history preview", true, v => { viewer.history.previewing = v; }],
    ["history lock", true, v => { viewer.history.locked = v; }],
  ]) {
    set(value); h.render();
    assert.equal(shortcut(), 0, label);
    assert.equal(h.current.button.disabled, true, label);
    assert.equal(h.current.button.shown, false, label);
    assert.equal(h.current.dialog.choices, undefined, label);
    assert.deepEqual(h.notices, [], label);
    set(false);
  }
  for (const online of [false, true]) {
    viewer.online = online; h.render();
    assert.equal(shortcut(), 1);
    assert.equal(h.notices.at(-1), r.exportReason({ hosted: true, role: "viewer" }));
    assert.equal(h.current.dialog.choices, undefined);
    assert.equal(h.current.button.shown, false);
  }
  for (const role of ["owner", "editor", undefined]) {
    h.props.hosted = hosted(role, { online: false }); h.render();
    assert.equal(h.current.button.shown, true);
    assert.equal(h.current.button.disabled, false);
    assert.equal(r.allowedToExport({ hosted: true, role }), !!role);
    assert.equal(h.current.button.open(new Button()), true); h.render();
    assert.equal(h.panels.at(-1), "");
    assert.equal(h.current.button.disabled, true);
    assert.equal(shortcut(), 0);
    h.close();
    assert.deepEqual(h.focus.at(-1), ["board", false]);
  }
  h.props.hosted = undefined; h.render();
  assert.equal(h.current.button.shown, true);
  for (const mods of [{ metaKey: false }, { ctrlKey: true }, { shiftKey: false }, { altKey: true },
    { nativeEvent: { isComposing: true } }]) assert.equal(shortcut(mods), 0);
  assert.equal(shortcut({}, new Target(["input"])), 0);
  assert.equal(shortcut({}, new Target()), 0);
  assert.equal(shortcut(), 1);
  assert.equal(h.current.dialog.hasSelection, false);
  h.close();
  assert.deepEqual(h.focus.at(-1), ["canvas", false]);
  Object.defineProperty(navigator, "platform", { configurable: true, value: "Linux" });
  assert.equal(shortcut(), 0);
  assert.equal(shortcut({ ctrlKey: true, metaKey: false }), 1);
  h.close();
});

test("X6-U12 dialog markup, modal mounting, Tab and Return, Escape and native close", async (t) => {
  const r = await exporter(), m = await harnessModules(), { board, first } = await fixture();
  const h = hook(t, m, board);
  const markup = props => renderToStaticMarkup(createElement(m.ExportDialog, { change: noop, close: noop, run: noop, ...props }));
  assert.equal(markup({}), "");
  for (const [type, groups] of [
    ["PNG", ["File type", "Background"]], ["JPG", ["File type", "Quality", "Background"]],
    ["PDF", ["File type", "Quality", "Background"]], ["CSV", ["File type", "Content type"]],
  ]) {
    const html = markup({ choices: choice(r, { type }), hasSelection: type !== "PDF" });
    assert.match(html, /^<dialog class="board-question export-dialog" aria-labelledby="export-dialog-title"><h2 id="export-dialog-title">Export<\/h2>/);
    assert.deepEqual([...html.matchAll(/<legend>([^<]*)<\/legend>/g)].map(m => m[1]), groups);
    assert.match(html, new RegExp('name="export-type" checked="" value="' + type + '"'));
    assert.match(html, /Export area.*<button type="button">Cancel<\/button><button type="button" class="primary">Export/);
    if (type !== "PDF") assert.match(html, /for="export-area">Export area<\/label><select id="export-area"><option selected="">Selection only<\/option><option>Entire page/);
    if (type === "PNG" || type === "JPG") assert.match(html, /name="export-background" checked="" value="Solid"/);
    if (type === "PDF") assert.match(html, /value="Low".*class="export-static">White.*class="export-static">Entire page/);
    if (type === "JPG") {
      assert.match(html, /name="export-quality" checked="" value="High"/);
      assert.match(html, /disabled="" name="export-background" value="Transparent"/);
    }
    if (type === "PDF") assert.match(html, /name="export-quality" checked="" value="Medium"/);
    if (type === "CSV") assert.match(html, /name="export-content" checked="" value="Tables"/);
  }
  h.props.selected = new Set([first.id]);
  h.render();
  h.open();
  replace(t, globalThis, "HTMLInputElement", Radio);
  replace(t, globalThis, "HTMLButtonElement", Button);
  const calls = [], radio = new Radio([], () => calls.push("radio")), last = new Button([], () => calls.push("export"));
  const cancel = new Button(), select = new Target();
  const modal = { open: false,
    showModal() { calls.push("showModal"); this.open = true; },
    querySelector(selector) { return selector === ".primary" ? last : radio; },
  };
  const dialog = () => m.ExportDialog({ ...h.current.dialog, run() { calls.push("run"); } }).props;
  dialog().ref(modal); dialog().ref(modal);
  assert.deepEqual(calls, ["showModal", "export"]);
  for (const [target, name, options, defaultPrevented, result] of [
    [last, "Tab", {}, 1, "radio"], [radio, "Tab", { shiftKey: true }, 1, "export"],
    [radio, "ArrowLeft", {}, 0, undefined], [radio, "Enter", {}, 1, "run"], [last, "Enter", {}, 1, "run"],
    [select, "Enter", {}, 0, undefined], [radio, "Enter", { shiftKey: true }, 0, undefined],
  ]) {
    const count = calls.length;
    const event = key(target, name, { currentTarget: modal, ...options });
    dialog().onKeyDown(event);
    assert.equal(event.stopped, 1);
    assert.equal(event.prevented, defaultPrevented);
    assert.deepEqual(calls.slice(count), result ? [result] : []);
  }
  const before = h.current.dialog.choices.type;
  h.change("type", "PDF");
  const escape = key(radio, "Escape");
  dialog().onCancel(escape);
  assert.equal(escape.prevented, 1);
  assert.deepEqual(h.focus.at(-1), ["canvas", false]);
  h.open(); assert.equal(h.current.dialog.choices.type, before);
  h.change("type", "CSV"); dialog().onClose();
  h.open(); assert.equal(h.current.dialog.choices.type, before);
  const event = key(cancel, "Enter", { currentTarget: modal });
  dialog().onKeyDown(event);
  assert.equal(event.prevented, 1);
  assert.equal(h.current.dialog.choices, undefined);
  assert.deepEqual(h.links, []);
});

test("X6-U13 the board panel and table tooltip keep the approved order and role conditions", async (t) => {
  await exporter();
  const m = await harnessModules(), { table } = await fixture();
  const panel = (exportButton, team) => renderToStaticMarkup(createElement(m.BoardPanel, {
    title: "Export check", boardFiles: { entries: [], heldLocks: [] }, importTable: { shown: true },
    exportButton, team,
  }));
  assert.match(panel({ shown: true }), /Save a copy to file<\/button><button>Export…<\/button><button>Open board file…<\/button><button>Import CSV…/);
  assert.match(panel({ shown: true, disabled: true }, { hosted: hosted("editor") }),
    /Save a copy to file<\/button><button disabled="">Export…<\/button><button>Import CSV…/);
  assert.doesNotMatch(panel(undefined), /Export…/);
  assert.doesNotMatch(panel({ shown: false }, { hosted: hosted("viewer") }), /Export…/);
  const bar = exportTable => renderToStaticMarkup(createElement(m.TableControls, {
    table, selection: { kind: "table", id: table.id }, reason: "", exportTable,
  }));
  replace(t, navigator, "platform", "MacIntel");
  for (const platform of ["MacIntel", "Linux"]) {
    Object.defineProperty(navigator, "platform", { value: platform });
    assert.match(bar(noop), /class="tooltip">Export as CSV<\/span>/);
  }
  assert.match(bar(Object.assign(() => {}, { disabled: true, reason: "Blocked" })), /class="tooltip">Blocked<\/span>/);
});

test("X6-U14 dialog choices stay per format during editing and persist across boards after Export", async (t) => {
  await exporter();
  const m = await harnessModules(), { board, first } = await fixture();
  const h = hook(t, m, board, { selected: new Set([first.id]) });
  h.open();
  h.change("pngBackground", "Grid");
  h.change("type", "JPG"); h.change("jpgQuality", "Low"); h.change("jpgBackground", "Grid");
  h.change("type", "PNG"); assert.equal(h.current.dialog.choices.pngBackground, "Grid");
  h.change("type", "JPG"); assert.equal(h.current.dialog.choices.jpgQuality, "Low");
  h.change("area", "Entire page");
  await h.run();
  h.props.board = { ...board, boardId: "another-board" }; h.props.page = "another-board";
  h.render(); h.open();
  assert.equal(h.current.dialog.hasSelection, false);
  assert.equal(h.current.dialog.choices.type, "JPG");
  assert.equal(h.current.dialog.choices.jpgQuality, "Low");
  assert.equal(h.current.dialog.choices.jpgBackground, "Grid");
  assert.equal(h.current.dialog.choices.pngBackground, "Solid");
  h.change("type", "CSV"); h.change("area", "Selection only");
  await h.run();
  const slots = [];
  const render = () => m.render(slots, () => m.useExport(h.props));
  render().open();
  assert.equal(render().dialog.choices.type, "CSV");
  assert.equal(render().dialog.choices.area, "Entire page");
  await tick();
});

test("X6-U15 ordered notices, picture padding and a silent success", async (t) => {
  await exporter();
  const m = await harnessModules(), { board, first, table } = await fixture();
  const h = hook(t, m, board, { selected: new Set([first.id]) });
  begin(h, "CSV", { csvType: "Tables", area: "Selection only" }); await h.run();
  h.props.selected = new Set([table.id]); h.render();
  begin(h, "CSV", { csvType: "Stickies" }); await h.run();
  h.props.objects = []; h.render();
  begin(h, "PNG"); await h.run();
  const far = { ...first, x: first.x + 40_000, id: "far" };
  h.props.objects = [drawn(first), drawn(far)]; h.props.selected = new Set([first.id, far.id]); h.render();
  begin(h, "PNG", { area: "Entire page" }); await h.run();
  begin(h, "PNG", { area: "Selection only" }); await h.run();
  h.props.objects[1] = drawn({ ...far, x: first.x + 8800 }); h.render();
  begin(h, "PNG"); await h.run();
  h.props.draw = () => { throw Error("cannot draw"); }; h.render();
  begin(h, "PNG"); await h.run();
  assert.deepEqual(h.notices, [
    "There are no tables to export.", "There are no stickies to export.", "There is nothing to export on this page.",
    "Could not export: the page is too large for one picture. Export a selection instead.",
    "Could not export: the selection is too large for one picture.",
    "Exported at 1.75× because the selection is too large for 2×.",
    "Could not export: the browser could not make the file.",
  ]);
  assert.equal(h.links.length, 1);
  h.props.objects = [drawn(first)]; h.render();
  begin(h, "CSV", { csvType: "Stickies" }); await h.run();
  assert.equal(h.notices.length, 7);
  assert.equal(h.links[1].download, "Plan 🎨.csv");
  assert.equal(h.blobs[1].type, "text/csv;charset=utf-8");
  assert.deepEqual(Buffer.from(await h.blobs[1].arrayBuffer()), Buffer.from('\uFEFFContent\r\n"Café, naïve"\r\n'));
  await tick();
  assert.deepEqual(h.revoked, ["blob:export-1", "blob:export-2"]);
});

test("X6-U16 waits for a size-matched picture each 250 ms for five seconds and freezes the drawing", async (t) => {
  await exporter();
  const m = await harnessModules(), { board, first } = await fixture();
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const image = { ...first, type: "image", asset: "synthetic-image", pixelWidth: 40, pixelHeight: 30, id: "image" };
  const wrong = new Map([[image.asset, { width: 39, height: 30 }]]);
  const h = hook(t, m, board, { objects: [drawn(image), drawn({ ...first, x: 40_000 })], bitmaps: wrong });
  begin(h, "PNG");
  const expired = h.run();
  for (let n = 0; n < 19; n++) {
    assert.deepEqual(h.notices, []);
    t.mock.timers.tick(250); await Promise.resolve();
  }
  assert.deepEqual(h.notices, []);
  t.mock.timers.tick(249); await Promise.resolve();
  assert.deepEqual(h.notices, []);
  t.mock.timers.tick(1); await expired;
  assert.deepEqual(h.notices, ["Could not export: an image on the board has not loaded yet."]);
  assert.deepEqual(h.links, []);

  h.props.objects = [drawn(image)]; h.render();
  begin(h, "PNG"); const pending = h.run();
  assert.equal(h.current.button.disabled, true);
  assert.equal(h.open(), false);
  const layouts = h.props.objectLayouts;
  h.props.objects = [drawn(first)]; h.props.objectLayouts = new Map();
  h.props.page = "other-page"; h.props.selected = new Set([first.id]);
  h.props.board = { ...board, title: "Renamed", objects: [] };
  h.props.bitmaps = new Map([[image.asset, { width: 40, height: 30 }]]); h.render();
  t.mock.timers.tick(249); await Promise.resolve();
  assert.deepEqual(h.draws, []);
  t.mock.timers.tick(1); await pending;
  assert.equal(h.links[0].download, "Plan 🎨.png");
  assert.equal(h.draws[0].board, board);
  assert.equal(h.draws[0].objectLayouts, layouts);
  assert.deepEqual(h.draws[0].only, new Set([image.id]));
  assert.equal(h.draws[0].bitmaps, h.props.bitmaps);
  assert.equal(h.notices.length, 1);
});

test("X6-U17 a board switch, unmount or access loss suppresses the completed file and notices", async (t) => {
  await exporter();
  const m = await harnessModules(), { board, first } = await fixture();
  const editor = hosted("editor");
  const h = hook(t, m, board, { hosted: editor, objects: [drawn(first)] });
  let finish;
  h.env.toBlob = callback => { finish = callback; };
  for (const [change, restore] of [
    [() => { h.props.hosted = hosted("editor", { boardId: "other-board" }); }, () => { h.props.hosted = editor; }],
    [() => { h.props.hosted = hosted("viewer"); }, () => { h.props.hosted = editor; }],
    [() => { h.canvas.isConnected = false; }, () => { h.canvas.isConnected = true; }],
  ]) {
    begin(h, "PNG");
    const done = h.run();
    assert.equal(h.current.button.disabled, true);
    assert.equal(h.open(), false);
    change(); h.render();
    finish(new Blob(["encoded"], { type: "image/png" }));
    await done;
    assert.deepEqual(h.links, []);
    assert.deepEqual(h.notices, []);
    restore(); h.render();
  }
  begin(h, "PNG");
  h.props.hosted = hosted(undefined); h.render();
  await h.run();
  assert.deepEqual(h.links, []);
  assert.deepEqual(h.notices, []);
});

test("X6-U18 encodes PNG, all JPEG qualities and PDF, including malformed encoder output", async (t) => {
  const r = await exporter(), m = await harnessModules(), { board, first } = await fixture();
  const h = hook(t, m, board, { objects: [drawn(first)] });
  begin(h, "PNG", { pngBackground: "Transparent" }); await h.run();
  assert.deepEqual(h.fills, []);
  begin(h, "PNG", { pngBackground: "Solid" }); await h.run();
  assert.deepEqual(h.fills, [["#FFFFFF", 0, 0, 992, 992]]);
  h.fills.length = 0;
  begin(h, "PNG", { pngBackground: "Grid" }); await h.run();
  assert.deepEqual(h.fills[0], ["#F5F5F5", 0, 0, 992, 992]);
  assert(h.fills.slice(1).every(([color, x, y, width, height]) =>
    [x, y, width, height].every(Number.isInteger) && color === "#C8C8C8" && height === 1));
  const dot = [...r.gridDots(h.draws[2].box)][0];
  const x = (dot.x - h.draws[2].box.x) * 2, y = (dot.y - h.draws[2].box.y) * 2;
  assert(h.fills.some(row => row.join() === ["#C8C8C8", x - 2, y, 4, 1].join()));
  for (const quality of ["High", "Medium", "Low"]) {
    begin(h, "JPG", { jpgQuality: quality }); await h.run();
  }
  for (const quality of ["High", "Medium", "Low"]) {
    begin(h, "PDF", { pdfQuality: quality }); await h.run();
  }
  assert.deepEqual(h.requests.map(({ type, quality, dimensions }) => [type, quality, dimensions.width, dimensions.height]), [
    ...Array.from({ length: 3 }, () => ["image/png", undefined, 992, 992]),
    ...[0.92, 0.80, 0.60].map(quality => ["image/jpeg", quality, 992, 992]),
    ...[1488, 992, 496].map(size => ["image/jpeg", 0.90, size, size]),
  ]);
  assert.deepEqual(h.links.map(link => link.download), ["png", "jpg", "pdf"].flatMap(ext => Array(3).fill("Plan 🎨." + ext)));
  assert.deepEqual(h.blobs.map(blob => blob.type), ["image/png", "image/jpeg", "application/pdf"].flatMap(type => Array(3).fill(type)));
  assert(h.blits.every(blit => blit.length === 4 && blit[2] === 0 && blit[3] === 0));
  assert.deepEqual(h.notices, []);
  for (const file of h.blobs.slice(-3)) assert.match(await file.text(), /\/MediaBox \[0 0 496 496\]/);
  for (const [format, blob] of [
    ["PDF", new Blob([jpeg(pixelSize)], { type: "image/jpeg" })],
    ["JPG", new Blob(["fallback"], { type: "image/png" })],
    ["PNG", null],
  ]) {
    h.env.toBlob = callback => callback(blob);
    begin(h, format); await h.run();
    assert.equal(h.notices.at(-1), "Could not export: the browser could not make the file.");
  }
  assert.equal(h.notices.length, 3);
  assert.equal(h.links.length, 9);
  await tick();
  assert.deepEqual(h.revoked, Array.from({ length: 9 }, (_, i) => `blob:export-${i + 1}`));
});

test("X6-U19 capture handlers ignore Export dialog keys and keep their keys outside it", async (t) => {
  await exporter();
  const m = await harnessModules(), { board } = await fixture();
  const calls = [], listeners = new Map(), canvas = new Target();
  const target = new Target([".export-dialog"]), other = new Target();
  const captures = { addEventListener(name, fn, capture) { if (name === "keydown") { assert.equal(capture, true); listeners.set(name, fn); } } };
  replace(t, globalThis, "Element", Target);
  replace(t, navigator, "platform", "MacIntel");
  replace(t, globalThis, "innerWidth", 1440);
  replace(t, globalThis, "innerHeight", 900);
  replace(t, globalThis, "matchMedia", () => ({ matches: false }));
  replace(t, globalThis, "document", { ...captures, body: other, visibilityState: "visible" });
  replace(t, globalThis, "window", { ...captures, innerHeight: 900 });
  const presence = { others: [], followed: "person" };
  const team = hosted("editor", {
    presence, getPresence: () => presence, toggleCursors: () => calls.push("presence"),
    spotlight: { visible: true, safetyChanged: noop, escape: () => calls.push("spotlight") },
    reactions: { armed: "star", bursts: [], disarm: () => calls.push("reaction tool"),
      ownsEvent: () => false, send: () => calls.push("reaction layer") },
    comments: { threads: new Map() },
  });
  const props = { board, boardId: board.boardId, page: board.boardId, selected: new Set(), scene: { current: canvas },
    view, size, hosted: team, tool: "Comment", displayedObjects: [], tidy: { open: false },
    setTool: () => calls.push("comments"), finishTextSession: () => calls.push("find"), setInline: noop };
  const cases = [
    [() => m.useFind(props), key(target, "f", { metaKey: true }), key(other, "f", { metaKey: true }), "find"],
    [() => m.usePresence(props), key(target, "\\", { code: "Backslash", altKey: true, metaKey: true }),
      key(other, "\\", { code: "Backslash", altKey: true, metaKey: true }), "presence"],
    [() => m.SpotlightLayer(props), key(target, "Escape"), key(other, "Escape"), "spotlight"],
    [() => m.ReactionTool(props), key(target, "Escape"), key(other, "Escape"), "reaction tool"],
    [() => m.ReactionsLayer(props), key(target, "Enter"), key(canvas, "Enter"), "reaction layer"],
    [() => { const active = m.CommentsLayer(props); return active.type(active.props); },
      key(target, "Escape"), key(other, "Escape"), "comments"],
  ];
  for (const [render, inside, outside, expected] of cases) {
    m.render([], render);
    const effect = m.effects.find(fn => fn.toString().includes('addEventListener("keydown"'));
    assert(effect, expected);
    listeners.clear();
    effect();
    const handler = listeners.get("keydown");
    assert(handler, expected);
    const before = calls.length;
    handler(inside);
    assert.equal(inside.prevented, 0, expected);
    assert.equal(inside.stopped, 0, expected);
    assert.equal(calls.length, before, expected);
    handler(outside);
    assert.equal(outside.prevented, 1, expected);
    assert.deepEqual(calls.slice(before), [expected]);
  }
});
