// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { add, empty, validate, canonical, upgrade } from "../packages/board-rules/src/document.ts";
import { Adapter } from "../apps/web/src/document-adapter.ts";
import { INK_KINDS, INK_WEIGHTS, inkWidth, inkColors, objectKeys, hasPoints, hasRectangle, eligibleIdea, sectionIdea, defaultDrawingStyle, drawingStyleFor, drawingKey, isDrawingTool } from "../packages/board-rules/src/objects/registry.ts";
import { drawingPoints, strokeGeometry, makeStroke, strokeHit, erasedStrokes, strokeInBox, absolutePoints, changeStrokeWeight, changeStrokeColor, changeOrdinaryColor, resizeWithStrokes, strokeFloor } from "../apps/web/src/strokes.ts";
import { hitObject, selectInBox, createConnector, connectReason } from "../apps/web/src/connectors.ts";
import { emptyHistory, record, undo, redo, duplicate, deleteObject } from "../apps/web/src/history.ts";
import { placeObject, moveWithMembers, objectLabel, commandObjectLabel, wrapSelection } from "../apps/web/src/sections.ts";
import { buildSnapshot, buildPaste, plainText } from "../apps/web/src/clipboard.ts";
import { expandSelection, groupNumbers, groupObjects } from "../apps/web/src/group.ts";
import { nearestHandle, cornerPoint } from "../apps/web/src/resize.ts";
import { activityBox, insertActivity } from "../apps/web/src/activities.ts";
import { readBoardFile, writeBoardFile } from "../apps/web/src/board-file.ts";

const board = () => ({ ...empty(), title: "Synthetic drawing" });
const style = (kind = "marker", weight = "thin", color = kind === "marker" ? "black" : "yellow") => ({ kind, weight, color });
const points = (...pairs) => pairs.map(([x, y]) => ({ x, y }));
const line = (b = board(), positions = points([0, 0], [100, 0]), ink = style()) => makeStroke(b, positions, ink, true, true);
const withLine = (b = board(), positions, ink) => placeObject(b, line(b, positions, ink));
const drawn = (b) => b.objects.map((o) => ({ ...o, displayHeight: o.height }));
const ids = (b) => new Set(b.objects.map((o) => o.id));
const editable = { readOnly: false, composing: false, pointerGesture: false, invalidObjectText: false };
const members = (objects) => objects.filter(hasRectangle).map((object) => ({ object, rectangle: { x: object.x, y: object.y, width: object.width, height: object.height } }));
const resize = (objects, delta, corner = "se") => resizeWithStrokes(corner, members(objects), delta, () => 0);

for (const kind of INK_KINDS) for (const weight of INK_WEIGHTS) test(`${kind.kind} ${weight}: exact keys, padding, colours and canonical order`, () => {
  const b = withLine(board(), points([20, 30], [80, 90]), style(kind.kind, weight));
  const o = b.objects[0], pad = inkWidth(o) / 2, bytes = canonical(b);
  assert.equal(b.schemaVersion, 10);
  assert.deepEqual(Object.keys(JSON.parse(bytes).objects[0]), ["id", "generation", "type", "kind", "color", "weight", "group", "section", "x", "y", "width", "height", "points", "order"]);
  assert.deepEqual(objectKeys("stroke", 8), Object.keys(JSON.parse(bytes).objects[0]));
  assert.deepEqual(o.points, [[pad, pad], [60 + pad, 60 + pad]]);
  assert.equal(o.width, 60 + 2 * pad); assert.equal(o.height, 60 + 2 * pad);
  assert.equal(canonical(validate(JSON.parse(bytes))), bytes);
  assert.equal(canonical({ ...b, objects: [Object.fromEntries(Object.entries(o).reverse())] }), bytes);
  assert.equal(inkColors(o).length, 8);
  for (const color of inkColors(o)) assert.doesNotThrow(() => canonical({ ...b, objects: [{ ...o, color: color.name }] }));
  const badColor = kind.kind === "marker" ? "pink" : "black";
  for (const change of [
    { color: badColor }, { kind: "unknown" }, { weight: "medium" }, { text: "" }, { textSize: "medium" }, { align: "left" }, { marks: [] },
    { width: o.width + .5 }, { height: o.height + 1 }, { points: [[pad + 1, pad], [pad + 60, pad + 60]] },
    { points: [[pad, pad], [o.width + 1, pad]] }, { points: [[pad, pad], [pad + 60, pad + 59]] },
    { points: [[pad, pad], [pad + 59, pad + 60]] }, { points: [[pad, pad], [pad + 60, pad + 60.5]] },
    { points: [[pad, pad, 3], [pad + 60, pad + 60]] },
  ]) {
    const invalid = { ...b, objects: [{ ...o, ...change }] }, before = structuredClone(invalid);
    assert.throws(() => validate(invalid)); assert.deepEqual(invalid, before);
  }
  for (const key of Object.keys(o)) { const copy = { ...o }; delete copy[key]; assert.throws(() => validate({ ...b, objects: [copy] }), key); }
});

test("a fractional middle point is rejected when endpoints and padding remain valid", () => {
  for (const kind of INK_KINDS) for (const weight of INK_WEIGHTS) {
    const b = withLine(board(), points([20, 30], [80, 90]), style(kind.kind, weight));
    const o = b.objects[0], pad = inkWidth(o) / 2;
    o.points = [[pad, pad], [pad + 30, pad + 30], [pad + 60, pad + 60]];
    assert.doesNotThrow(() => validate(b));
    o.points[1][0] += .5;
    assert.throws(() => validate(b));
  }
});

test("points limits accept 2 and 1000, reject 1 and 1001; other types reject stroke keys and legacy versions reject strokes", () => {
  const b = withLine(), o = b.objects[0];
  for (const n of [2, 1000]) assert.doesNotThrow(() => canonical({ ...b, objects: [{ ...o, points: [o.points[0], ...Array.from({ length: n - 1 }, () => o.points[1])] }] }));
  for (const n of [1, 1001]) assert.throws(() => canonical({ ...b, objects: [{ ...o, points: Array.from({ length: n }, () => o.points[0]) }] }));
  for (let version = 1; version <= 7; version++) assert.throws(() => validate({ ...b, schemaVersion: version }));
  for (const type of ["sticky", "text", "shape", "section"]) for (const key of ["kind", "weight", "points"]) {
    const other = add(board(), type, 0, 0); other.objects[0][key] = o[key]; assert.throws(() => validate(other));
  }
  let connected = add(add(board(), "sticky", 0, 0), "text", 400, 0);
  connected = createConnector(connected, connected.objects[0].id, connected.objects[1].id).board;
  for (const key of ["kind", "weight", "points"]) {
    const invalid = structuredClone(connected); invalid.objects.find((o) => o.from)[key] = o[key]; assert.throws(() => validate(invalid));
  }
  const full = withLine(connected), invalid = structuredClone(full);
  invalid.objects.find((o) => o.from).from.object = full.objects.at(-1).id;
  assert.throws(() => validate(invalid), /connector ends/);
  assert.equal(eligibleIdea(o), false); assert.equal(sectionIdea(o), true);
  assert.throws(() => createConnector(full, full.objects[0].id, full.objects.at(-1).id));
  assert.equal(connectReason(full, new Set([full.objects[0].id, full.objects.at(-1).id]), editable), "Select exactly two ideas to connect.");
});

test("all seven legacy versions keep their own bytes and in-memory upgrade records no edit", () => {
  const current = add(board(), "sticky", 0, 0); current.objects[0].text = "你好 🧭";
  for (let version = 1; version <= 7; version++) {
    const old = structuredClone(current); old.schemaVersion = version;
    for (const o of old.objects) {
      if (version < 2) { delete o.color; delete o.textSize; delete o.align; }
      if (version < 3) delete o.group; if (version < 4) delete o.marks; if (version < 5) delete o.section;
    }
    const bytes = canonical(old), decoded = validate(JSON.parse(bytes)), before = structuredClone(decoded), upgraded = upgrade(decoded);
    assert.equal(canonical(decoded), bytes); assert.deepEqual(decoded, before); assert.equal(upgraded.schemaVersion, 10);
    assert.deepEqual(upgraded.objects, current.objects); assert.equal(upgrade(upgraded), upgraded);
    assert.deepEqual(record(emptyHistory(), upgraded, upgrade(decoded)), emptyHistory());
  }
});

test("adapter stores points atomically without text/style/marks, recreates ink and history restores identity and points", () => {
  const before = board(), b = withLine(before), o = b.objects[0], adapter = new Adapter();
  adapter.set(b);
  const map = adapter.doc.getMap("objects").get(o.id), stored = map.get("points");
  assert.deepEqual(stored, o.points); assert(Array.isArray(stored));
  for (const key of ["text", "style", "marks", "ends"]) assert.equal(map.has(key), false);
  assert.equal(map.get("kind"), o.kind); assert.equal(map.get("color"), o.color); assert.equal(map.get("weight"), o.weight);
  const events = []; map.observe((e) => events.push([...e.keysChanged]));
  const weighted = { ...b, objects: [changeStrokeWeight(o, "thick")] }; adapter.set(weighted);
  assert.deepEqual(events, [["weight", "points", "geometry"]]);
  const restored = validate(JSON.parse(canonical(weighted))), recreated = new Adapter(); recreated.set(restored);
  assert.deepEqual([...recreated.doc.getMap("objects").get(o.id).entries()], [...map.entries()]);
  const history = record(emptyHistory(), before, b), undone = undo(b, history), redone = redo(undone.board, undone.history);
  assert.equal(undone.board.objects.length, 0); assert.equal(redone.board.objects[0].id, o.id);
  assert.notEqual(redone.board.objects[0].generation, o.generation); assert.deepEqual(redone.board.objects[0].points, o.points);
  const projected = { ...b, objects: [{ ...o, ...map.get("geometry"), kind: map.get("kind"), color: map.get("color"), weight: map.get("weight"), points: map.get("points") }] };
  assert.equal(canonical(projected), canonical(weighted)); adapter.destroy(); recreated.destroy();
});

test("click rule makes a 4 by 4 marker dot and no highlight; limit refuses a new stroke", () => {
  const b = board(), positions = points([10, 20], [11, 21]), dot = makeStroke(b, positions, style(), false);
  assert.deepEqual([dot.x, dot.y, dot.width, dot.height, dot.points], [8, 18, 4, 4, [[2, 2], [2, 2]]]);
  assert.equal(makeStroke(b, positions, style("highlighter"), false), null);
  assert.throws(() => makeStroke({ ...b, objects: Array(250).fill(dot) }, positions, style(), true), /250 object limit/);
  assert.throws(() => makeStroke({ ...b, objects: Array(250).fill(dot) }, positions, style("highlighter"), false), /250 object limit/);
});

test("drawing smooths once, thins by the exact 1000-index rule, keeps ends, and Shift bypasses smoothing", () => {
  const positions = points([0, 0], [10, 20], [20, 0], [30, 40]);
  assert.deepEqual(drawingPoints(positions), points([0, 0], [10, 10], [20, 15], [30, 40]));
  const many = Array.from({ length: 2500 }, (_, i) => ({ x: i, y: i % 5 }));
  const smooth = many.map((p, i) => !i || i === many.length - 1 ? p : { x: i, y: (many[i - 1].y + 2 * p.y + many[i + 1].y) / 4 });
  const thinned = drawingPoints(many); assert.equal(thinned.length, 1000);
  assert.deepEqual(thinned, Array.from({ length: 1000 }, (_, i) => smooth[Math.round(i * 2499 / 999)]));
  assert.deepEqual(drawingPoints(positions, true), [positions[0], positions.at(-1)]);
  const o = makeStroke(board(), many, style(), true); assert.equal(o.points.length, 1000);
  assert.equal(makeStroke(board(), many, style(), true, true).points.length, 2);
});

for (const kind of INK_KINDS) for (const weight of INK_WEIGHTS) test(`${kind.kind} ${weight}: drawing rounds and clamps the padded rectangle to all board edges`, () => {
  const b = withLine(board(), points([-1e6 - 10.5, 1e6 + 10.5], [1e6 + 3, -1e6 - 3]), style(kind.kind, weight));
  const o = b.objects[0]; assert.doesNotThrow(() => validate(b));
  assert.deepEqual([o.x, o.y, o.x + o.width, o.y + o.height], [-1e6, -1e6, 1e6, 1e6]);
  const g = strokeGeometry(points([10.4, 20.6], [30.6, 40.4]), style(kind.kind, weight));
  assert.deepEqual(g.points.map(([x, y]) => [g.x + x, g.y + y]), [[10, 21], [31, 40]]);
});

test("selection uses ink or 8 CSS pixels, empty bounds stay empty, and flat ends have no round-cap hit", () => {
  const thin = line(), highlight = line(board(), points([0, 0], [100, 0]), style("highlighter", "thick"));
  for (const zoom of [1, 2]) {
    assert(strokeHit(thin, { x: 50, y: 8 / zoom }, zoom)); assert(!strokeHit(thin, { x: 50, y: 8.01 / zoom }, zoom));
    assert(strokeHit(thin, { x: 50, y: 5 / zoom }, zoom));
    assert(strokeHit(highlight, { x: 50, y: 19 }, zoom));
    assert(!strokeHit(highlight, { x: 100 + 8.01 / zoom, y: 0 }, zoom));
    assert(!strokeHit(highlight, { x: 101, y: 19 }, zoom));
  }
  const bent = line(board(), points([0, 0], [100, 0], [100, 100]));
  assert(!strokeHit(bent, { x: 20, y: 70 }, 1));
  const b = add(board(), "sticky", 30, 20), withStroke = withLine(b), o = withStroke.objects.at(-1);
  assert.equal(hitObject(drawn(withStroke), { x: 50, y: 5 }, 1).id, o.id);
  assert.equal(hitObject(drawn(withStroke), { x: 50, y: 30 }, 1).id, b.objects[0].id);
});

test("box selects a whole stroke, then group expansion includes a stroke outside the box", () => {
  let b = add(board(), "sticky", 0, 0); b = withLine(b, points([500, 500], [600, 500]));
  const stroke = b.objects.at(-1), box = { x: stroke.x, y: stroke.y, width: stroke.width, height: stroke.height };
  assert(strokeInBox(stroke, box)); assert(!strokeInBox(stroke, { ...box, width: box.width - 1 }));
  assert.deepEqual(selectInBox({ x: box.x, y: box.y }, { x: box.x + box.width - 1, y: box.y + box.height }, drawn(b)), []);
  assert.deepEqual(selectInBox({ x: box.x, y: box.y }, { x: box.x + box.width, y: box.y + box.height }, drawn(b)), [stroke.id]);
  b = groupObjects(b, ids(b));
  const selected = selectInBox({ x: -120, y: -120 }, { x: 120, y: 120 }, drawn(b));
  assert.deepEqual([...expandSelection(b.objects, selected)], b.objects.map((o) => o.id));
});

test("eraser sweeps between events, clicks painted ink and uses exactly 6 CSS pixels at two zooms", () => {
  const b = withLine(add(board(), "sticky", 0, 0)), o = b.objects.at(-1);
  assert.deepEqual(erasedStrokes(b.objects, points([50, -100], [50, 100]), 1).map((o) => o.id), [o.id]);
  assert.deepEqual(erasedStrokes(b.objects, points([50, 0]), 1).map((o) => o.id), [o.id]);
  for (const zoom of [1, 2]) {
    assert.equal(erasedStrokes(b.objects, points([50, 2 + 6 / zoom]), zoom).length, 1);
    assert.equal(erasedStrokes(b.objects, points([50, 2 + 6.01 / zoom]), zoom).length, 0);
    const h = line(board(), points([0, 0], [100, 0]), style("highlighter", "thick"));
    assert.equal(erasedStrokes([h], points([50, 20 + 6 / zoom]), zoom).length, 1);
    assert.equal(erasedStrokes([h], points([100 + 6.01 / zoom, 19]), zoom).length, 0);
  }
  assert.deepEqual(erasedStrokes(b.objects.filter((o) => !hasPoints(o)), points([-100, 0], [100, 0]), 1), []);
});

test("whole-stroke erasing is one history step, restores array positions and leaves unrelated objects untouched", () => {
  let b = withLine(add(board(), "sticky", 0, 0)); b = withLine(b, points([0, 50], [100, 50]));
  const touched = erasedStrokes(b.objects, points([50, -100], [50, 100]), 1);
  const removed = deleteObject(b, emptyHistory(), touched); assert.equal(removed.history.past.length, 1);
  assert.deepEqual(removed.board.objects, [b.objects[0]]);
  const restored = undo(removed.board, removed.history);
  assert.deepEqual(restored.board.objects.map(({ generation, ...o }) => o), b.objects.map(({ generation, ...o }) => o));
});

for (const corner of ["nw", "ne", "sw", "se"]) test(`resize ${corner}: scales points, keeps weight and opposite rectangle corner`, () => {
  const o = line(board(), points([0, 0], [100, 50]), style("highlighter", "thin"));
  const delta = { x: corner.endsWith("e") ? o.width : -o.width, y: corner.startsWith("s") ? o.height : -o.height };
  const next = resize([o], delta, corner)[0], opposite = { nw: "se", ne: "sw", sw: "ne", se: "nw" }[corner];
  assert.equal(next.weight, o.weight); assert.equal(next.width, 222); assert.equal(next.height, 122);
  assert.deepEqual(cornerPoint(opposite, next), cornerPoint(opposite, o));
  assert.doesNotThrow(() => canonical({ ...board(), objects: [next] }));
});

test("three-point resizing at factor 11/6 rounds every point and recomputes the exact rectangle", () => {
  const b = withLine(board(), points([10, 20], [18, 28]));
  const o = { ...b.objects[0], points: [[2, 2], [5, 7], [10, 10]] };
  assert.doesNotThrow(() => validate({ ...b, objects: [o] }));
  // Wider adds 10 to the 12-unit selection width: 22/12 = 1.8333… .
  const next = resize([o], { x: 10, y: 0 })[0];
  assert.deepEqual(next.points, [[2, 2], [8, 11], [17, 17]]);
  assert.deepEqual({ x: next.x, y: next.y, width: next.width, height: next.height },
    { x: 8, y: 18, width: 19, height: 19 });
  assert.doesNotThrow(() => validate({ ...b, objects: [next] }));
});

test("stroke floor, fixed padding, dot floor and mixed selection stop at the first object's floor", () => {
  const o = line(board(), points([0, 0], [100, 0]));
  const small = resize([o], { x: -1000, y: -1000 })[0];
  assert.equal(small.width, 12); assert.equal(small.height, 4); assert.equal(strokeFloor(small), 1);
  const square = line(board(), points([0, 0], [8, 8]));
  const wider = resize([square], { x: 10, y: 0 })[0]; assert.deepEqual([wider.width, wider.height], [19, 19]);
  const dot = makeStroke(board(), points([0, 0]), style(), false);
  assert.deepEqual(resize([dot], { x: -10, y: -10 })[0], dot);
  assert.deepEqual(resize([small], { x: -10, y: -10 })[0], small);
  const b = withLine(add(board(), "sticky", 300, 0));
  const mixed = resize(b.objects, { x: -10000, y: -10000 });
  assert.equal(mixed[0].width, 80); assert(mixed[1].width > 12);
  assert.doesNotThrow(() => canonical({ ...b, objects: mixed }));
});

test("resizing at every board edge stays valid and never clips the centreline", () => {
  for (const [positions, corner, delta] of [
    [points([999890, 0], [999990, 50]), "se", { x: 1e7, y: 0 }],
    [points([-999990, 0], [-999890, 50]), "nw", { x: -1e7, y: 0 }],
    [points([0, 999890], [50, 999990]), "se", { x: 0, y: 1e7 }],
    [points([0, -999990], [50, -999890]), "nw", { x: 0, y: -1e7 }],
  ]) {
    const b = withLine(board(), positions), next = resize(b.objects, delta, corner);
    assert.doesNotThrow(() => canonical({ ...b, objects: next }));
    assert(Math.abs((next[0].width - 4) / (next[0].height - 4) - (b.objects[0].width - 4) / (b.objects[0].height - 4)) < .06);
  }
});

test("nearest overlapping handles uses distance then north-west, north-east, south-west, south-east tie order", () => {
  const handles = ["nw", "ne", "sw", "se"].map((corner) => ({ corner, ...cornerPoint(corner, { x: 0, y: 0, width: 100, height: 4 }) }));
  assert.equal(nearestHandle(handles, { x: 100, y: 4 }, 1).corner, "se");
  assert.equal(nearestHandle(handles, { x: 100, y: 2 }, 1).corner, "ne");
  const tiny = ["nw", "ne", "sw", "se"].map((corner) => ({ corner, ...cornerPoint(corner, { x: 0, y: 0, width: 4, height: 4 }) }));
  assert.equal(nearestHandle(tiny, { x: 2, y: 2 }, 2).corner, "nw");
  assert.equal(nearestHandle([...tiny].reverse(), { x: 2, y: 2 }, 2).corner, "nw");
  assert.equal(nearestHandle(handles, { x: 50, y: 50 }, 1), undefined);
});

test("weight keeps the absolute centreline, grows padding, and refuses the board edge atomically", () => {
  for (const kind of INK_KINDS) {
    const o = line(board(), points([10, 20], [100, 80]), style(kind.kind)), next = changeStrokeWeight(o, "thick");
    assert.deepEqual(absolutePoints(next), absolutePoints(o));
    const difference = inkWidth(next) - inkWidth(o); assert.equal(next.width, o.width + difference); assert.equal(next.height, o.height + difference);
    assert.deepEqual(changeStrokeWeight(next, "thin"), o);
    const edge = line(board(), points([-1e6, 0], [-999900, 0]), style(kind.kind)), before = structuredClone(edge);
    assert.throws(() => changeStrokeWeight(edge, "thick"), { message: "The stroke would exceed the board edges." }); assert.deepEqual(edge, before);
  }
});

test("mixed selections separate ordinary colours and stroke colours and refuse a shared stroke colour across kinds", () => {
  let b = withLine(add(board(), "sticky", 0, 0)); const selected = ids(b), original = structuredClone(b.objects[1]);
  const changed = changeOrdinaryColor(b.objects, selected, "blue"); assert.equal(changed[0].color, "blue"); assert.deepEqual(changed[1], original);
  const ink = changeStrokeColor(b.objects, selected, "red"); assert.deepEqual(ink[0], b.objects[0]); assert.equal(ink[1].color, "red");
  b = withLine(b, points([0, 50], [100, 50]), style("highlighter"));
  assert.deepEqual(changeStrokeColor(b.objects, ids(b), "green"), b.objects);
  assert.deepEqual(changeStrokeColor(b.objects, ids(b), "not-ink"), b.objects);
});

test("copies and duplicates keep ink and points with fresh IDs, remap groups and sections, and omit stroke text separators", () => {
  let b = add(board(), "section", 0, 0); b = add(b, "text", 0, 0); b.objects[1].text = "A";
  b = withLine(b, points([10, 10], [80, 30])); b = placeObject(b, add(b, "text", 0, 50).objects.at(-1)); b.objects.at(-1).text = "B";
  const container = b.objects[0], stroke = b.objects.find(hasPoints);
  assert.equal(stroke.section, container.id);
  b.objects[1].section = container.id;
  b = groupObjects(b, new Set([b.objects[1].id, stroke.id]));
  const snapshot = buildSnapshot(b, ids(b), drawn(b)); assert.equal(plainText(buildSnapshot(b, new Set(b.objects.slice(1).map((o) => o.id)), drawn(b))), "A\n\nB");
  assert.equal(plainText(buildSnapshot(b, new Set([stroke.id]), drawn(b))), "");
  const pasted = buildPaste(b, snapshot, { centerX: 0, centerY: 0, zoom: 1, width: 2000, height: 2000 }).board;
  const copies = pasted.objects.filter((o) => !ids(b).has(o.id)), copied = copies.find(hasPoints), copiedSection = copies.find((o) => o.type === "section");
  assert.deepEqual([copied.kind, copied.color, copied.weight, copied.points], [stroke.kind, stroke.color, stroke.weight, stroke.points]);
  assert.notEqual(copied.generation, stroke.generation); assert.notEqual(copied.group, b.objects.find(hasPoints).group);
  assert.equal(copied.section, copiedSection.id); assert.equal(copied.group, copies.find((o) => o.text === "A").group);
  assert.notEqual(copied.points, stroke.points); assert.doesNotThrow(() => canonical(pasted));
  const doubled = duplicate(b, emptyHistory(), b.objects.filter((o) => o.id === container.id)).board;
  assert.equal(doubled.objects.filter(hasPoints).length, 2); assert.doesNotThrow(() => canonical(doubled));
});

test("command labels use stroke prefixes and Objects idea numbering while preserving text-object labels", () => {
  let b = add(add(add(board(), "section", 0, 0), "sticky", 0, 0), "text", 400, 0);
  const ideas = b.objects.filter(eligibleIdea);
  b = createConnector(b, ideas[0].id, ideas[1].id).board;
  b = withLine(b);
  b = withLine(b, points([0, 50], [100, 50]), style("highlighter"));
  const strokes = b.objects.filter(hasPoints);
  assert.equal(commandObjectLabel(b, strokes[0]), "marker stroke 3");
  assert.equal(commandObjectLabel(b, strokes[1]), "highlight 4");
  for (const o of strokes) {
    assert.equal(commandObjectLabel(b, o), objectLabel(b, o, groupNumbers(b.objects)).split(" · ")[0]);
  }
  assert.equal(commandObjectLabel(b, b.objects[0]), "section 1 · Section");
  assert.equal(commandObjectLabel(b, b.objects[1]), "connector 2 · Empty");
  assert.equal(commandObjectLabel(b, b.objects[2]), "sticky 3 · Empty");
  assert.equal(commandObjectLabel(b, { ...b.objects[3], text: "A\nB" }), "text 4 · A\nB");
  assert.equal(commandObjectLabel(b, { ...b.objects[3], text: "x".repeat(40) }), "text 4 · " + "x".repeat(36));
});

test("strokes move without changing points, label without text, wrap in sections and contribute to template placement", () => {
  let b = withLine(); const o = b.objects[0], moved = moveWithMembers(b, ids(b), 10.5, 20.5);
  assert.deepEqual(moved.objects[0].points, o.points); assert.doesNotThrow(() => canonical(moved));
  assert.equal(objectLabel(b, o, groupNumbers(b.objects)), "marker stroke 1");
  const wrapped = wrapSelection(b, ids(b), drawn(b)); b = wrapped.board;
  assert.equal(objectLabel(b, b.objects.find(hasPoints), groupNumbers(b.objects)), "marker stroke 1 · in Section");
  const h = line(b, points([20, 20], [80, 20]), style("highlighter")); b = placeObject(b, h);
  assert.equal(objectLabel(b, b.objects.find((o) => o.id === h.id), groupNumbers(b.objects)), "highlight 2 · in Section");
  const activity = { ...add(board(), "sticky", 0, 0), schemaVersion: 7 }, before = activityBox(b.objects);
  const inserted = insertActivity(b, activity, { x: 0, y: 0, z: 1 }, { w: 1280, h: 800 });
  const added = inserted.board.objects.find((o) => inserted.ids.includes(o.id)); assert.equal(added.x, before.right + 120);
});

test("a board file round-trips a stroke including fractional positions and all points", async () => {
  const original = withLine(), b = moveWithMembers(original, ids(original), .25, .5);
  const raw = await writeBoardFile(b), bytes = new TextEncoder().encode(raw);
  const read = await readBoardFile({ size: bytes.length, arrayBuffer: async () => bytes.buffer });
  assert.equal(canonical(read), canonical(b)); assert.deepEqual(read, b);
});

test("drawing tools and session defaults expose the declared keys and separate kind styles", () => {
  assert.deepEqual(INK_KINDS.map((k) => k.widths), [[4, 10], [22, 40]]);
  assert.deepEqual(inkColors(style()).map((c) => c.name), ["black", "red", "orange", "yellow", "green", "blue", "violet", "white"]);
  assert.deepEqual(inkColors(style("highlighter")).map((c) => c.name), ["grey", "pink", "orange", "yellow", "green", "cyan", "violet", "white"]);
  const styles = defaultDrawingStyle();
  assert.deepEqual(drawingStyleFor("Marker", styles), style()); assert.deepEqual(drawingStyleFor("Highlighter", styles), style("highlighter"));
  assert.equal(drawingKey("M", false), "Marker"); assert.equal(drawingKey("m", true), "Highlighter");
  for (const key of ["Delete", "Backspace"]) assert.equal(drawingKey(key, true), "Eraser");
  assert.equal(drawingKey("Delete", false), undefined); assert.equal(drawingKey("Enter", false), undefined);
  assert.equal(isDrawingTool("Eraser"), true); assert.equal(isDrawingTool("Select"), false);
  styles.marker.color = "red"; assert.equal(styles.highlighter.color, "yellow");
});
