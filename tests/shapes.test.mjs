// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { add, empty, canonical, validate, Adapter } from "../apps/web/src/document.ts";
import { shape, SHAPE_KINDS, SHAPE_COLORS, FILL_MODES, BORDER_STYLES, darkened, shapeColor,
  shapeTextColor, shapeTextBox, shapeTextLayout, fitHeight, canGrow, changeKind, changeFill,
  changeBorder, commonShapeValue, defaultPaint, paintOf, paintAfterStep, creationValues,
  objectType, usesShapePaint } from "../apps/web/src/objects/registry.ts";
import { layoutRuns, graphemes } from "../apps/web/src/text-runs.ts";
import { emptyHistory, record, undo, redo, duplicate, deleteObject } from "../apps/web/src/history.ts";
import { buildSnapshot, buildPaste } from "../apps/web/src/clipboard.ts";
import { drawRectangle, placeObject, objectLabel } from "../apps/web/src/sections.ts";
import { resizeObject, resizeSet } from "../apps/web/src/resize.ts";
import { groupNumbers } from "../apps/web/src/group.ts";

const board = () => ({ ...empty(), title: "Shape planning" });
const withShape = () => add(board(), shape.type, 0, 0);
const selected = (b) => new Set(b.objects.map((o) => o.id));
const measure = (text, style) => graphemes(text).length * (style.bold ? 11 : 10);
function textLayout(o) {
  const layout = (width) => layoutRuns(o.text, o.marks, width, measure);
  return { layout, result: shapeTextLayout(o, layout, measure), height: fitHeight(o, layout, measure) };
}
function apply(b, ids, change) {
  return { ...b, objects: b.objects.map((o) => ids.has(o.id) && usesShapePaint(o) ? change(o) : o) };
}
function exactUndo(before, after) {
  const history = record(emptyHistory(), before, after);
  assert.equal(history.past.length, 1);
  const back = undo(after, history);
  assert.equal(canonical(back.board), canonical(before));
  assert.equal(canonical(redo(back.board, back.history).board), canonical(after));
  return history;
}

test("v6 shape defaults, per-type key sets and canonical nested key order", () => {
  let b = withShape();
  assert.equal(b.schemaVersion, 7);
  assert.deepEqual(b.objects[0], { ...b.objects[0], shape: "square", fill: { mode: "fill", color: "white" },
    border: { style: "solid", color: "dark-gray" }, color: "neutral", textSize: "small", align: "center", width: 180, height: 180, text: "" });
  b = add(add(add(b, "sticky", 500, 0), "text", 800, 0), "section", 0, 500);
  const parsed = JSON.parse(canonical(b));
  assert.deepEqual(Object.keys(parsed.objects[0]), ["id", "generation", "type", "text", "color", "textSize", "align", "group", "marks", "section", "shape", "fill", "border", "x", "y", "width", "height", "order"]);
  assert.deepEqual(Object.keys(parsed.objects[0].fill), ["mode", "color"]);
  assert.deepEqual(Object.keys(parsed.objects[0].border), ["style", "color"]);
  for (const o of parsed.objects.slice(1)) for (const key of shape.extraKeys) assert(!Object.hasOwn(o, key));
  const shuffled = { ...b, objects: b.objects.map((o) => Object.fromEntries(Object.entries({ ...o,
    ...(usesShapePaint(o) ? { fill: { color: o.fill.color, mode: o.fill.mode }, border: { color: o.border.color, style: o.border.style } } : {}),
  }).reverse())) };
  assert.equal(canonical(shuffled), canonical(b));
  assert.deepEqual(validate(parsed), b);
});

test("v6 validates both kinds, all modes/styles, all 21 names and lowercase custom paint", () => {
  const b = withShape();
  assert.equal(SHAPE_COLORS.length, 21);
  for (const kind of SHAPE_KINDS) for (const mode of FILL_MODES) for (const style of BORDER_STYLES)
    for (const color of [...SHAPE_COLORS.map((c) => c.name), "#7a3cf0", "#000000"])
      assert.doesNotThrow(() => canonical({ ...b, objects: [{ ...b.objects[0], shape: kind.kind,
        fill: { mode: mode.value, color }, border: { style: style.value, color } }] }));
  const invalid = [
    (o) => o.shape = "triangle", (o) => o.color = "blue",
    (o) => o.fill.mode = "opaque", (o) => o.border.style = "dotted",
    ...["#ABCDEF", "#fff", "navy", "#abcdeg", "blue ", null, {}, 2].flatMap((color) => [
      (o) => o.fill.color = color, (o) => o.border.color = color,
    ]),
    (o) => o.fill.extra = 1, (o) => o.border.extra = 1,
    (o) => o.fill = null, (o) => o.border = [],
    ...shape.extraKeys.map((key) => (o) => delete o[key]),
    (o) => o.width = 39, (o) => o.height = 39, (o) => o.width = 2001, (o) => o.height = 2001,
    (o) => o.text = "a".repeat(1001),
  ];
  for (const mutate of invalid) {
    const x = structuredClone(b); mutate(x.objects[0]);
    const before = structuredClone(x);
    assert.throws(() => validate(x)); assert.deepEqual(x, before);
  }
  for (const size of [40, 2000]) assert.doesNotThrow(() => validate({ ...b, objects: [{ ...b.objects[0], width: size, height: size }] }));
});

test("shape keys are required only on shapes and shapes are rejected in versions 1-5", () => {
  const b = withShape();
  for (const version of [1, 2, 3, 4, 5]) {
    const o = { ...b.objects[0] };
    for (const key of shape.extraKeys) delete o[key];
    if (version < 5) delete o.section;
    if (version < 4) delete o.marks;
    if (version < 3) delete o.group;
    if (version < 2) for (const key of ["color", "textSize", "align"]) delete o[key];
    assert.throws(() => validate({ ...b, schemaVersion: version, objects: [o] }));
  }
  for (const type of ["sticky", "text", "section"]) for (const key of shape.extraKeys) {
    const other = add(board(), type, 0, 0); other.objects[0][key] = b.objects[0][key];
    assert.throws(() => validate(other));
  }
});

test("adapter stores kind and paint atomically, updates existing maps and recreates paint", () => {
  const b = withShape(), adapter = new Adapter(); adapter.set(b);
  const map = adapter.doc.getMap("objects").get(b.objects[0].id), text = map.get("text");
  assert.deepEqual(map.get("fill"), b.objects[0].fill);
  const changes = []; map.observe((event) => changes.push([...event.keysChanged].sort()));
  let transactions = 0; adapter.doc.on("afterTransaction", () => transactions++);
  const changed = apply(b, selected(b), (o) => changeBorder(changeFill(changeKind(o, "circle"), { color: "blue" }), { style: "dashed" }));
  adapter.set(changed);
  assert.equal(transactions, 1); assert.deepEqual(changes, [["border", "fill", "shape"]]);
  assert.equal(map.get("shape"), "circle"); assert.equal(map.get("text"), text);
  assert.equal(map, adapter.doc.getMap("objects").get(b.objects[0].id));
  const recreated = new Adapter(); recreated.set(validate(JSON.parse(canonical(changed))));
  for (const key of shape.extraKeys) assert.deepEqual(recreated.doc.getMap("objects").get(b.objects[0].id).get(key), map.get(key));
  const fill = map.get("fill"); adapter.set(changed); assert.equal(map.get("fill"), fill);
  adapter.destroy(); recreated.destroy();
});

test("darkened borders match independently specified values for every named colour and custom", () => {
  const expected = ["#171717", "#505050", "#ac362c", "#b8702c", "#b99533", "#459750", "#3b9a93", "#2e75b8", "#6845b9", "#b13b83", "#bfbfbf", "#868686", "#a7a7a7", "#bc9b98", "#bea894", "#beb493", "#9eb69f", "#99b6b3", "#9bacbc", "#aaa2bc", "#bc9fb1"];
  assert.deepEqual(SHAPE_COLORS.map((c) => darkened(c.name)), expected);
  assert.equal(darkened("#204060"), "#183048");
  for (const c of SHAPE_COLORS) {
    assert.equal(shapeTextColor({ fill: { mode: "transparent", color: c.name } }), "#2c2c2c");
    assert.equal(shapeTextColor({ fill: { mode: "none", color: c.name } }), "#2c2c2c");
  }
  for (const color of ["black", "blue"]) assert.equal(shapeTextColor({ fill: { mode: "fill", color } }), "#ffffff");
  for (const color of ["white", "yellow"]) assert.equal(shapeTextColor({ fill: { mode: "fill", color } }), "#2c2c2c");
});

test("square and ellipse text boxes use the contracted insets", () => {
  const o = withShape().objects[0];
  assert.deepEqual(shapeTextBox(o), { x: -74, y: -78, width: 148, height: 156 });
  const box = shapeTextBox({ ...o, shape: "circle" });
  assert.equal(box.x, o.x + o.width * (1 - 1 / Math.SQRT2) / 2 + 6);
  assert.equal(box.y, o.y + o.height * (1 - 1 / Math.SQRT2) / 2 + 4);
  assert(Math.abs(box.width - (180 / Math.SQRT2 - 12)) < 1e-12);
  assert(Math.abs(box.height - (180 / Math.SQRT2 - 8)) < 1e-12);
});

test("overflow uses a grapheme-safe ellipsis with the preceding character's marks", () => {
  const o = { ...withShape().objects[0], text: "👩🏽‍💻éab\nnext", marks: [{ start: 0, end: 9, bold: true }], width: 72, height: 45 };
  const { result } = textLayout(o);
  assert.equal(result.fits, false); assert.equal(result.lines.length, 1);
  const drawn = result.lines[0].pieces;
  assert.equal(drawn.map((p) => p.text).join(""), "👩🏽‍💻é…");
  assert.deepEqual(drawn.at(-1).style, { bold: true });
  assert(result.lines[0].width <= result.box.width);
  const alone = textLayout({ ...o, text: "a\nb", width: 42, marks: [{ start: 0, end: 1, bold: true }] }).result;
  // Bold a is wider than the box: nothing can be laid out at all.
  assert.deepEqual(alone.lines, []);
  const ellipsisOnly = textLayout({ ...o, text: "a\nb", width: 43, marks: [{ start: 0, end: 1, bold: true }] }).result;
  assert.equal(ellipsisOnly.lines[0].pieces[0].text, "…");
  assert.deepEqual(ellipsisOnly.lines[0].pieces[0].style, {});
});

test("no line and no ellipsis draw when the text box is too short or narrow", () => {
  const o = { ...withShape().objects[0], text: "a\nb", width: 180, height: 40 };
  assert.deepEqual(textLayout(o).result.lines, []);
  assert.deepEqual(textLayout({ ...o, height: 80, width: 40 }).result.lines, []);
  const customMeasure = (text) => graphemes(text).reduce((sum, g) => sum + (g === "…" ? 30 : 5), 0);
  const narrow = { ...o, width: 52, height: 45 };
  const layout = (width) => layoutRuns(narrow.text, [], width, customMeasure);
  assert.deepEqual(shapeTextLayout(narrow, layout, customMeasure).lines, []);
});

test("fit height is minimal, respects 2000 and bottom edge and controls Grow availability", () => {
  for (const kind of SHAPE_KINDS) {
    const o = { ...withShape().objects[0], shape: kind.kind, text: "one\ntwo\nthree\nfour", height: 40 };
    const { layout, height } = textLayout(o);
    assert(height > o.height);
    assert(shapeTextLayout({ ...o, height }, layout, measure).fits);
    assert(!shapeTextLayout({ ...o, height: height - .000001 }, layout, measure).fits);
    assert(canGrow(true, true, false, o.height, height));
    assert(!canGrow(true, true, true, height, height));
    const long = textLayout({ ...o, text: "a\n".repeat(400) }); assert.equal(long.height, 2000);
    const edge = { ...o, y: 999950 }; assert.equal(textLayout(edge).height, 50);
    assert(!canGrow(true, true, false, 50, 50));
  }
  for (const args of [[false, true, false, 40, 100], [true, false, false, 40, 100], [true, true, false, 40, 100, "Read only"]]) assert(!canGrow(...args));
});

test("kind/fill/border commands preserve all other content and undo each batch in one step", () => {
  let b = add(withShape(), shape.type, 250, 0);
  const group = crypto.randomUUID(); b.objects = b.objects.map((o) => ({ ...o, group, text: "Bold idea", marks: [{ start: 0, end: 4, bold: true }] }));
  for (const ids of [new Set([b.objects[0].id]), selected(b)]) {
    const kind = apply(b, ids, (o) => changeKind(o, "circle")); exactUndo(b, kind);
    for (let i = 0; i < b.objects.length; i++) assert.deepEqual({ ...kind.objects[i], shape: b.objects[i].shape }, b.objects[i]);
    const fill = apply(b, ids, (o) => changeFill(o, { color: "blue" })); exactUndo(b, fill);
    for (const o of fill.objects.filter((o) => ids.has(o.id))) { assert.equal(o.fill.color, "blue"); assert.equal(o.border.color, "#2e75b8"); assert.equal(o.border.style, "solid"); }
    const mode = apply(fill, ids, (o) => changeFill(o, { mode: "none" })); exactUndo(fill, mode);
    for (let i = 0; i < b.objects.length; i++) assert.deepEqual(mode.objects[i].border, fill.objects[i].border);
    const border = apply(fill, ids, (o) => changeBorder(o, { style: "dashed", color: "#204060" })); exactUndo(fill, border);
    for (let i = 0; i < b.objects.length; i++) assert.deepEqual(border.objects[i].fill, fill.objects[i].fill);
  }
});

test("mixed selections affect only their subsets and each shape field has independent Mixed values", () => {
  let b = add(add(add(withShape(), shape.type, 220, 0), "sticky", 400, 0), "text", 800, 0);
  b = add(b, "section", 400, 500);
  const after = apply(b, selected(b), (o) => changeFill(o, { color: "blue" })); exactUndo(b, after);
  assert.deepEqual(after.objects.slice(2), b.objects.slice(2));
  const shapes = after.objects.filter(usesShapePaint);
  assert.equal(commonShapeValue(shapes, (o) => o.fill.color), "blue");
  shapes[1] = changeBorder(changeKind(shapes[1], "circle"), { style: "none", color: "red" });
  assert.equal(commonShapeValue(shapes, (o) => o.shape), "");
  assert.equal(commonShapeValue(shapes, (o) => o.fill.mode), "fill");
  assert.equal(commonShapeValue(shapes, (o) => o.fill.color), "blue");
  assert.equal(commonShapeValue(shapes, (o) => o.border.style), "");
  assert.equal(commonShapeValue(shapes, (o) => o.border.color), "");
  const colour = { ...after, objects: after.objects.map((o) => usesShapePaint(o) ? o : { ...o, color: "teal" }) };
  exactUndo(after, colour); assert.deepEqual(colour.objects.slice(0, 2), after.objects.slice(0, 2));
});

test("session paint follows only paint-changing commits, Undo and Redo, and resets", () => {
  const b = add(withShape(), shape.type, 250, 0);
  const next = { ...b, objects: b.objects.map((o, i) => changeFill(o, { color: i ? "yellow" : "blue" })) };
  const history = exactUndo(b, next), step = history.past.at(-1);
  assert.deepEqual(paintAfterStep(step, false), paintOf(next.objects[1]));
  assert.deepEqual(paintAfterStep(step, true), defaultPaint());
  const back = undo(next, history);
  assert.deepEqual(paintAfterStep(back.history.future.at(-1), false), paintOf(next.objects[1]));
  const border = apply(next, selected(next), (o) => changeBorder(o, { style: "dashed", color: "#204060" }));
  assert.deepEqual(paintAfterStep(record(emptyHistory(), next, border).past.at(-1), false), paintOf(border.objects[1]));
  const copied = duplicate(next, emptyHistory(), next.objects);
  const deleted = deleteObject(next, emptyHistory(), next.objects);
  const kind = apply(next, selected(next), (o) => changeKind(o, "circle"));
  for (const h of [record(emptyHistory(), board(), next), copied.history, deleted.history, record(emptyHistory(), next, kind)]) {
    for (const direction of [false, true]) assert.equal(paintAfterStep(h.past.at(-1), direction), undefined);
  }
  assert.deepEqual(defaultPaint(), { fill: { mode: "fill", color: "white" }, border: { style: "solid", color: "dark-gray" } });
  const created = creationValues(b.objects[0], "Circle", paintOf(border.objects[1]));
  assert.equal(created.shape, "circle"); assert.deepEqual(paintOf(created), paintOf(border.objects[1]));
});

test("shape resize has a 40 height floor and retains v11 width floors alone and in a set", () => {
  const o = { ...withShape().objects[0], text: "long\n".repeat(100) };
  const resized = resizeObject("se", o, { x: -500, y: -500 }, false, () => objectType(o.type).growsWithText ? 2000 : 0, shape.sizeRange);
  assert.equal(resized.height, 40); assert.equal(resized.width, 80);
  const narrow = resizeObject("se", { ...o, width: 50 }, { x: -500, y: 0 }, false, () => 0, shape.sizeRange);
  assert.equal(narrow.width, 50);
  const set = resizeSet("se", [o, { ...o, x: 150 }].map((o) => ({ ...o, sizeRange: shape.sizeRange, neededHeight: () => 0 })), { x: -1000, y: -1000 }, false);
  for (const rect of set) { assert.equal(rect.width, 80); assert.equal(rect.height, 40); }
});

test("placing and drawing clamp dimensions, reverse drags, board edges and section membership", () => {
  const b = withShape();
  assert.deepEqual(drawRectangle({ x: 100, y: 80 }, { x: -120, y: -60 }, shape.sizeRange), { x: -120, y: -60, width: 220, height: 140 });
  assert.deepEqual(drawRectangle({ x: 0, y: 0 }, { x: 1, y: 1 }, shape.sizeRange), { x: 0, y: 0, width: 40, height: 40 });
  const huge = drawRectangle({ x: 999999, y: 999999 }, { x: 2e6, y: 2e6 }, shape.sizeRange);
  assert.deepEqual(huge, { x: 998000, y: 998000, width: 2000, height: 2000 });
  for (const value of [-1e6, 1e6]) {
    const placed = add(board(), shape.type, value, value).objects[0];
    assert.equal(placed.width, 180); assert.equal(placed.height, 180);
    assert(placed.x >= -1e6 && placed.x + placed.width <= 1e6);
  }
  const container = add(board(), "section", 0, 0), item = add(container, shape.type, 300, 0).objects.at(-1);
  const placed = placeObject(container, item);
  assert.equal(placed.objects.at(-1).section, container.objects[0].id);
  assert.equal(placed.objects.at(-1).id, item.id);
  const removed = undo(placed, record(emptyHistory(), container, placed));
  assert.deepEqual(removed.board.objects, container.objects);
  assert(removed.board.retiredGenerations.includes(item.generation));
  assert.throws(() => add({ ...b, objects: Array(250).fill(b.objects[0]) }, shape.type, 0, 0));
});

test("snapshot, Paste and Duplicate keep paint and marks with fresh identities", () => {
  const b = withShape();
  b.objects[0] = { ...changeBorder(changeFill(changeKind(b.objects[0], "circle"), { color: "#7a3cf0" }), { color: "#204060", style: "dashed" }), text: "Pilot", marks: [{ start: 0, end: 5, italic: true }] };
  const snapshot = buildSnapshot(b, selected(b), b.objects.map((o) => ({ ...o, displayHeight: o.height })));
  assert.deepEqual(paintOf(snapshot.objects[0]), paintOf(b.objects[0]));
  assert.notEqual(snapshot.objects[0].fill, b.objects[0].fill);
  const pasted = buildPaste(b, snapshot, { centerX: 0, centerY: 0, zoom: 1, width: 1280, height: 800 });
  const duplicated = duplicate(b, emptyHistory(), b.objects[0]);
  for (const result of [pasted, duplicated]) {
    validate(result.board);
    const copy = result.board.objects[1];
    assert.notEqual(copy.id, b.objects[0].id); assert.notEqual(copy.generation, b.objects[0].generation);
    for (const key of [...shape.extraKeys, "text", "marks", "color", "textSize", "align", "width", "height"]) assert.deepEqual(copy[key], b.objects[0][key]);
  }
});

test("Objects numbers squares and circles among ideas, retaining group and section suffixes", () => {
  let b = add(add(add(board(), "section", 0, 0), "sticky", 0, 0), shape.type, 0, 0);
  b = add(b, shape.type, 300, 0);
  const group = crypto.randomUUID();
  b.objects[2] = { ...b.objects[2], text: "Recruit pilots", section: b.objects[0].id, group };
  b.objects[3] = { ...b.objects[3], shape: "circle", text: "Go live", group };
  const numbers = groupNumbers(b.objects);
  assert.equal(objectLabel(b, b.objects[2], numbers), "square 2 · Group 1 · Recruit pilots · in Section");
  assert.equal(objectLabel(b, b.objects[3], numbers), "circle 3 · Group 1 · Go live");
});

// Exercise the actual state commands without a DOM or browser. Esbuild resolves
// the app's extensionless imports; React's server renderer supplies real hooks.
const { build } = await import("../apps/web/node_modules/esbuild/lib/main.js");
const reactURL = new URL("../apps/web/node_modules/react/index.js", import.meta.url);
const { createElement } = await import(reactURL.href);
const { renderToStaticMarkup } = await import("../apps/web/node_modules/react-dom/server.node.js");
const compiled = await build({ stdin: {
  contents: 'export { useEditingCommands } from "./state/use-editing-commands.ts"; export { useBoardDocument } from "./state/use-board-document.ts"; export { useGeometryEdits } from "./state/use-geometry-edits.ts"; export { useCanvasInput } from "./state/use-canvas-input.ts"; export { ShapeControls, ShapeFields } from "./ui/shape-controls.tsx";',
  resolveDir: new URL("../apps/web/src/", import.meta.url).pathname, loader: "ts",
}, bundle: true, write: false, platform: "node", format: "esm", plugins: [{ name: "shared-react", setup(build) {
  build.onResolve({ filter: /^(react(?:\/.*)?|yjs)$/ }, (args) => ({ path: args.path === "react" ? reactURL.href : new URL(args.path === "yjs" ? "../apps/web/node_modules/yjs/dist/yjs.mjs" : "../apps/web/node_modules/" + args.path + ".js", import.meta.url).href, external: true }));
} }] });
const hooks = await import("data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].text).toString("base64"));
function commandHarness(b, options = {}) {
  let result;
  renderToStaticMarkup(createElement(function Harness() {
    const doc = hooks.useBoardDocument({ readOnly: false, setStatus() {} });
    doc.model.current = b;
    const ids = selected(b), editor = { current: null };
    const commands = hooks.useEditingCommands({ ...doc, select() {}, selected: ids, editor,
      setMessage() {}, messageSequence: { current: 0 }, alive: { current: true },
      setInline() {}, scene: { current: null }, view: { x: 0, y: 0, z: 1 },
      displayedObjects: b.objects.map((o) => ({ ...o, displayHeight: o.height })),
      commandReason: "", selectionReason: "", clipboardState: {}, editingState: {}, arrangementMembers: [],
      lineCount: () => 500, setPanel() {}, setTool() {}, growAvailable: false, growHeight: 0, ...options,
    });
    const geometry = hooks.useGeometryEdits({ ...doc, selected: ids, editor, item: b.objects[0], select() {},
      objectLayouts: new Map(b.objects.map((o) => [o.id, { height: o.height }])), readOnly: false, busy: false,
      composing: false, setStatus() {}, setTool() {}, setPanel() {}, setInline() {}, setMessage() {}, lineCount: () => 500,
    });
    const surface = { getBoundingClientRect: () => ({ left: 0, top: 0 }), focus() {}, setPointerCapture() {}, hasPointerCapture: () => false };
    const scene = { current: surface }, drag = { current: null }, armed = { current: options.tool ?? "Square" };
    const canvas = hooks.useCanvasInput({ ...doc, ...geometry, shapeSession: doc.shapeSession,
      scene, drag, selected: ids, select() {}, setView() {}, trackPointer() {}, setMessage() {},
      view: { x: 0, y: 0, z: 1 }, size: { w: 1280, h: 800 }, busy: false, setBusy() {},
      spacePanRef: { current: false }, setSpacePan() {}, setSelectionBox() {}, tool: armed.current,
      setTool: (tool) => { armed.current = tool; }, readOnly: false, composing: false, inline: false, setInline() {}, setPanel() {},
      handlesVisible: false, handlePoints: [], objectLayouts: new Map(b.objects.map((o) => [o.id, { height: o.height }])),
      displayedObjects: b.objects.map((o) => ({ ...o, displayHeight: o.height })), edit() {}, ...options,
    });
    result = { doc, commands, geometry, canvas, surface, drag, armed }; return null;
  }));
  return result;
}

test("actual editing commands change only their subsets, keep fixed size and update session paint through history", () => {
  let b = add(add(withShape(), shape.type, 250, 0), "sticky", 500, 0);
  b.objects[0].text = "Long shape text";
  const h = commandHarness(b), { doc, commands } = h;
  commands.shapeCommands.changeFill({ color: "blue" });
  assert.equal(doc.historyRef.current.past.length, 1);
  assert.deepEqual(doc.model.current.objects[2], b.objects[2]);
  assert.equal(doc.shapeSession.paint.current.fill.color, "blue");
  commands.shapeCommands.changeBorder({ style: "dashed", color: "#204060" });
  assert.equal(doc.historyRef.current.past.length, 2);
  commands.command("Undo");
  assert.equal(doc.shapeSession.paint.current.border.style, "solid");
  commands.command("Redo");
  assert.equal(doc.shapeSession.paint.current.border.color, "#204060");
  const paint = structuredClone(doc.shapeSession.paint.current);
  commands.shapeCommands.changeShape("circle");
  commands.command("Undo"); commands.command("Redo");
  assert.deepEqual(doc.shapeSession.paint.current, paint);
  commands.changeStyle("color", "teal");
  assert.equal(doc.model.current.objects[0].color, "neutral");
  assert.equal(doc.model.current.objects[2].color, "teal");
  commands.changeStyle("textSize", "extra-large");
  assert.equal(doc.model.current.objects[0].height, 180);
  assert.equal(doc.model.current.objects[1].height, 180);
  assert.equal(doc.model.current.objects[2].height, 2000);
  h.geometry.commitText(b.objects[0].id, "a\n".repeat(200));
  assert.equal(doc.model.current.objects[0].height, 180);
  commands.command("Duplicate"); commands.command("Undo"); commands.command("Redo");
  assert.deepEqual(doc.shapeSession.paint.current, paint);
  commands.command("Delete"); commands.command("Undo");
  assert.deepEqual(doc.shapeSession.paint.current, paint);
  doc.load(board()); assert.deepEqual(doc.shapeSession.paint.current, paint);
  doc.adapter.current.destroy();
  const fresh = commandHarness(withShape()); assert.deepEqual(fresh.doc.shapeSession.paint.current, defaultPaint());
  fresh.doc.adapter.current.destroy();
});

test("actual create and resize routes take session paint, kind, section and fixed text floor", () => {
  const b = add(board(), "section", 0, 0), h = commandHarness(b);
  h.doc.shapeSession.update({ fill: { mode: "transparent", color: "blue" }, border: { style: "dashed", color: "#204060" } });
  const paint = structuredClone(h.doc.shapeSession.paint.current);
  h.geometry.create("Circle", 0, 0);
  const created = h.doc.model.current.objects.at(-1);
  assert.equal(created.shape, "circle"); assert.deepEqual(paintOf(created), paint);
  assert.equal(created.section, b.objects[0].id); assert.equal(created.width, 180); assert.equal(created.height, 180);
  assert.deepEqual(h.doc.shapeSession.paint.current, paint);
  const resizing = commandHarness({ ...withShape(), objects: [{ ...withShape().objects[0], text: "text" }] });
  const original = resizing.doc.model.current.objects[0];
  const resized = resizing.geometry.resizedBoard("se", [{ object: original, rectangle: original }], -1000, -1000, false);
  assert.equal(resized.objects[0].height, 40); assert.equal(resized.objects[0].width, 80);
  h.doc.adapter.current.destroy(); resizing.doc.adapter.current.destroy();
});

test("actual pointer drawing and click/Enter placement keep kind, session paint and reverse/clamped geometry", () => {
  for (const tool of ["Square", "Circle"]) {
    const h = commandHarness(board(), { tool });
    const event = (x, y) => ({ target: h.surface, currentTarget: h.surface, clientX: x + 640,
      clientY: y + 400, pointerId: 1, button: 0, preventDefault() {} });
    h.doc.shapeSession.update({ fill: { mode: "fill", color: "blue" }, border: { style: "solid", color: "#2e75b8" } });
    h.canvas.pointerDown(event(100, 80)); h.canvas.pointerMove(event(-120, -60)); h.canvas.pointerUp(event(-120, -60));
    const o = h.doc.model.current.objects[0];
    assert.deepEqual([o.x, o.y, o.width, o.height], [-120, -60, 220, 140]);
    assert.equal(o.shape, tool.toLowerCase()); assert.equal(o.fill.color, "blue");
    assert.equal(h.armed.current, "Select"); assert.equal(h.doc.historyRef.current.past.length, 1);
    h.doc.adapter.current.destroy();
    const click = commandHarness(board(), { tool });
    const e = { ...event(0, 0), target: click.surface, currentTarget: click.surface };
    click.canvas.pointerDown(e); click.canvas.pointerUp(e);
    assert.deepEqual([click.doc.model.current.objects[0].width, click.doc.model.current.objects[0].height], [180, 180]);
    assert.equal(click.doc.model.current.objects[0].shape, tool.toLowerCase());
    click.doc.adapter.current.destroy();
    const key = commandHarness(board(), { tool });
    key.canvas.sceneKeyDown({ target: key.surface, currentTarget: key.surface, key: "Enter", nativeEvent: {}, preventDefault() {} });
    assert.deepEqual([key.doc.model.current.objects[0].x, key.doc.model.current.objects[0].y], [-90, -90]);
    key.doc.adapter.current.destroy();
  }
});

test("actual scene R/O keys arm kinds only with the allowed focus and editing state", () => {
  const h = commandHarness(board());
  const key = (value, extra = {}) => ({ target: h.surface, currentTarget: h.surface, key: value,
    nativeEvent: {}, preventDefault() {}, ...extra });
  h.canvas.sceneKeyDown(key("o")); assert.equal(h.armed.current, "Circle");
  h.canvas.sceneKeyDown(key("r")); assert.equal(h.armed.current, "Square");
  for (const extra of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }, { target: {} }, { nativeEvent: { isComposing: true } }]) {
    h.canvas.sceneKeyDown(key("o", extra)); assert.equal(h.armed.current, "Square");
  }
  for (const options of [{ readOnly: true }, { inline: true }, { composing: true }, { busy: true }]) {
    const blocked = commandHarness(board(), options);
    blocked.canvas.sceneKeyDown({ ...key("o"), target: blocked.surface, currentTarget: blocked.surface });
    assert.equal(blocked.armed.current, "Square"); blocked.doc.adapter.current.destroy();
  }
  h.doc.adapter.current.destroy();
});

test("actual Grow to fit text commits one step and its Undo preserves paint", () => {
  const b = withShape(); b.objects[0].height = 40; b.objects[0].text = "one\ntwo\nthree";
  const height = textLayout(b.objects[0]).height;
  const h = commandHarness(b, { growAvailable: true, growHeight: height });
  h.commands.shapeCommands.grow();
  assert.equal(h.doc.model.current.objects[0].height, height);
  assert.deepEqual({ ...h.doc.model.current.objects[0], height: 40 }, b.objects[0]);
  assert.equal(h.doc.historyRef.current.past.length, 1);
  h.commands.command("Undo"); assert.equal(canonical(h.doc.model.current), canonical(b));
  assert.deepEqual(h.doc.shapeSession.paint.current, defaultPaint());
  h.doc.adapter.current.destroy();
});

test("shape controls expose kind, paint, Mixed values and Objects fields without browser state", () => {
  const b = withShape(), item = b.objects[0];
  const selection = { objects: [item], hasOther: false, kind: item.shape, fillMode: item.fill.mode,
    fillColor: item.fill.color, borderStyle: item.border.style, borderColor: item.border.color };
  const commands = { changeShape() {}, changeFill() {}, changeBorder() {}, grow() {} };
  const refs = () => ({ kind: { current: null }, fill: { current: null }, border: { current: null } });
  const popup = { open: "", toggle() {}, close() {}, controls: refs(), buttons: refs(), menu: { current: null } };
  const props = { selection, commands, popup, reason: "" };
  const kind = renderToStaticMarkup(createElement(hooks.ShapeControls, { ...props, part: "kind" }));
  const paint = renderToStaticMarkup(createElement(hooks.ShapeControls, { ...props, part: "paint" }));
  assert.match(kind, /aria-label="Shape: Square"/); assert.doesNotMatch(kind, /aria-label="Fill:/);
  assert.match(paint, /aria-label="Fill: White"/); assert.match(paint, /aria-label="Border: Solid, Dark gray"/);
  const mixed = renderToStaticMarkup(createElement(hooks.ShapeControls, { ...props, part: "paint",
    selection: { ...selection, fillColor: "", borderStyle: "" } }));
  assert.match(mixed, /aria-label="Fill: Mixed"/); assert.match(mixed, /aria-label="Border: Mixed"/);
  const panel = renderToStaticMarkup(createElement(hooks.ShapeControls, { ...props, part: "paint", popup: { ...popup, open: "fill" } }));
  for (const c of SHAPE_COLORS) assert(panel.includes('aria-label="' + c.label + '"'));
  assert.match(panel, /type="color"/); assert.match(panel, /aria-label="Custom colour"/);
  const fields = renderToStaticMarkup(createElement(hooks.ShapeFields, { ...props,
    selection: { ...selection, fillColor: "blue", borderColor: "#2e75b8" } }));
  assert.match(fields, /Darker Blue \(from fill\)/);
  for (const label of ["Shape", "Fill", "Fill colour", "Border", "Border colour"]) assert(fields.includes('>' + label + '</label>'));
});
