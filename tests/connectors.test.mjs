// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { add, empty, validate, canonical } from "../packages/board-rules/src/document.ts";
import { Adapter } from "../packages/board-sync/src/document-adapter.ts";
import { hasEnds, hasRectangle, eligibleIdea, typeWithEnds, objectKeys, CONNECTOR_STYLE_KEYS } from "../packages/board-rules/src/objects/registry.ts";
import { connectorRoute, roundedPath, halfway, sideMidpoints, labelBox, labelEditorBox, arrowPoints,
  connectorLayout, lineHit, hitObject, connectorInBox, selectInBox, createConnector, bands, cascade, cascadeCount,
  copiedSet, copiedSetReason, connectReason, FOLLOW_REASON, COPY_REASON } from "../apps/web/src/connectors.ts";
import { connectionDots, pressedDot, connectionTarget } from "../apps/web/src/connection-drag.ts";
import { record, emptyHistory, undo, redo, duplicate, deleteObject } from "../apps/web/src/history.ts";
import { buildSnapshot, buildPaste, clipboardReason } from "../apps/web/src/clipboard.ts";
import { assignSection, placeObject, moveWithMembers, orderInBands, objectLabel, wrapSelection } from "../apps/web/src/sections.ts";
import { groupObjects, groupReason } from "../apps/web/src/group.ts";
import { arrangePositions, arrangeReason } from "../apps/web/src/arrange.ts";
import { displayHeight } from "../apps/web/src/geometry.ts";

const editable = { readOnly: false, composing: false, pointerGesture: false, invalidObjectText: false };
const measure = (s) => Array.from(s).length * 10;
const base = () => add(add(add({ ...empty(), title: "Connections" }, "sticky", 0, 0), "shape", 500, 0), "text", 0, 400);
const join = (b = base(), a = b.objects[0].id, z = b.objects[1].id) => createConnector(b, a, z).board;
const connector = (b) => (Array.isArray(b) ? b : b.objects).find(hasEnds);
const ids = (...objects) => new Set(objects.map((o) => o.id));
function drawn(b) {
  const rectangles = new Map(b.objects.filter(hasRectangle).map((o) => [o.id, { ...o, displayHeight: o.height }]));
  return b.objects.map((o) => {
    const layout = hasEnds(o) ? connectorLayout(o, rectangles, measure) : undefined;
    return { ...o, ...layout?.bounds, displayHeight: layout?.bounds.height ?? o.height, connectorLayout: layout };
  });
}
const rect = (x = 0, y = 0, width = 100, height = 100) => ({ x, y, width, height });
const coordinates = (points) => points.map(({ x, y }) => [x, y]);

test("v7 connector canonical keys, fixed values, no geometry and end key order", () => {
  const b = join(), line = connector(b), parsed = JSON.parse(canonical(b)).objects.find(hasEnds);
  assert.equal(b.schemaVersion, 10);
  assert.deepEqual(Object.keys(parsed), ["id", "generation", "type", "text", "color", "textSize", "align", "group", "marks", "section", "from", "to", ...CONNECTOR_STYLE_KEYS, "order"]);
  assert.deepEqual(Object.keys(parsed.from), ["object", "anchor"]); assert.deepEqual(Object.keys(parsed.to), ["object", "anchor"]);
  assert.deepEqual(objectKeys(line.type, 9), Object.keys(parsed));
  for (const version of [7, 8]) assert.deepEqual(objectKeys(line.type, version), Object.keys(parsed).filter((key) => !CONNECTOR_STYLE_KEYS.includes(key)));
  assert.deepEqual(validate(JSON.parse(canonical(b))), b);
  assert.deepEqual([line.text, line.color, line.textSize, line.align, line.group, line.marks, line.section], ["", "neutral", "medium", "center", null, [], null]);
  const shuffled = { ...b, objects: b.objects.map((o) => Object.fromEntries(Object.entries(hasEnds(o) ? {
    ...o, from: { anchor: "auto", object: o.from.object }, to: { anchor: "auto", object: o.to.object },
  } : o).reverse())) };
  assert.equal(canonical(shuffled), canonical(b));
  for (const key of ["x", "y", "width", "height", "route", "labelPoint", "extra"]) {
    const invalid = structuredClone(b); connector(invalid)[key] = 0;
    assert.throws(() => validate(invalid), key);
  }
});

test("v7 validates both ends and fixed shared values without repairing bad records", () => {
  const b = join(), section = add(b, "section", 100, 100).objects.at(-1);
  const full = placeObject(b, section), line = connector(full);
  const invalid = [
    (o) => delete o.from, (o) => delete o.to, (o) => o.from = null, (o) => o.to = [],
    (o) => o.from.extra = true, (o) => delete o.to.anchor,
    (o) => o.to.anchor = 0, (o) => o.from.object = [o.from.object],
    (o) => o.from.object = crypto.randomUUID(), (o) => o.to.object = section.id,
    (o) => o.to.object = line.id, (o) => o.to.object = o.from.object,
    (o) => o.color = "blue", (o) => o.textSize = "small", (o) => o.align = "left",
    (o) => o.marks = [{ start: 0, end: 1, bold: true }],
    (o) => o.group = crypto.randomUUID(), (o) => o.section = section.id,
  ];
  for (const mutate of invalid) {
    const board = structuredClone(full); mutate(connector(board)); const before = structuredClone(board);
    assert.throws(() => validate(board)); assert.throws(() => canonical(board)); assert.deepEqual(board, before);
  }
  for (const version of [7, 8]) {
    const old = structuredClone(full); old.schemaVersion = version;
    for (const o of old.objects.filter(hasEnds)) for (const key of CONNECTOR_STYLE_KEYS) delete o[key];
    assert.doesNotThrow(() => validate(old)); connector(old).from.anchor = "left";
    assert.throws(() => validate(old));
  }
  for (const o of full.objects.filter(hasRectangle)) for (const key of ["from", "to"]) {
    const board = structuredClone(full); board.objects.find((item) => item.id === o.id)[key] = line[key];
    assert.throws(() => validate(board));
  }
  const labelled = { ...line, text: "🧭".repeat(100) };
  assert.doesNotThrow(() => canonical({ ...full, objects: full.objects.map((o) => o.id === line.id ? labelled : o) }));
  labelled.text += "🧭";
  assert.throws(() => canonical({ ...full, objects: full.objects.map((o) => o.id === line.id ? labelled : o) }));
  for (const version of [1, 2, 3, 4, 5, 6]) assert.throws(() => validate({ ...b, schemaVersion: version }));
  assert.doesNotThrow(() => canonical(join(b, line.from.object, line.to.object)));
  assert.doesNotThrow(() => canonical(join(b, line.to.object, line.from.object)));
});

test("all five types retain v7 canonical order in an interleaved array", () => {
  let b = join(); b = placeObject(b, add(b, "section", 0, 0).objects.at(-1));
  b.objects = [b.objects[2], b.objects[0], b.objects[1], ...b.objects.slice(3)].map((o, order) => ({ ...o, order }));
  const parsed = JSON.parse(canonical(b));
  assert.deepEqual(parsed.objects.map((o) => o.id), b.objects.map((o) => o.id));
  for (const o of parsed.objects) assert.deepEqual(Object.keys(o), objectKeys(o.type, 9));
});

test("adapter ends are atomic, recreate exactly and never change when an idea moves", () => {
  const b = join(), line = connector(b), adapter = new Adapter(); adapter.set(b);
  const map = adapter.doc.getMap("objects").get(line.id), events = [];
  assert.equal(map.has("geometry"), false); assert.equal(map.has("from"), false); assert.equal(map.has("to"), false);
  const ends = map.get("ends"); assert.deepEqual(ends, { from: line.from, to: line.to });
  assert(!adapter.doc.getMap("objects").get(line.from.object).has("ends"));
  map.observe((e) => events.push([...e.keysChanged]));
  const moved = moveWithMembers(b, new Set([line.from.object]), 25, 50); adapter.set(moved);
  assert.equal(map.get("ends"), ends); assert.deepEqual(events, []);
  const changed = { ...moved, objects: moved.objects.map((o) => o.id === line.id ? { ...o, to: { object: b.objects.at(-1).id, anchor: "auto" } } : o) };
  adapter.set(changed); assert.deepEqual(events, [["ends"]]);
  assert.equal(map, adapter.doc.getMap("objects").get(line.id));
  const recreated = new Adapter(); recreated.set(validate(JSON.parse(canonical(changed))));
  assert.deepEqual(recreated.doc.getMap("objects").get(line.id).get("ends"), map.get("ends"));
  adapter.destroy(); recreated.destroy();
});

test("dots and routes use the drawn sticky height, with CSS pixel offsets and press radius", () => {
  const o = { ...base().objects[0], x: 10, y: 20, width: 200, height: 160, displayHeight: displayHeight({ y: 20, height: 160 }, 5) };
  assert.equal(o.displayHeight, 171);
  assert.deepEqual(coordinates(sideMidpoints(o)), [[10, 105.5], [210, 105.5], [110, 20], [110, 191]]);
  for (const zoom of [.5, 2]) {
    const dots = connectionDots([o], ids(o), zoom);
    assert.equal(dots.length, 4); assert.deepEqual(dots[3].start, { x: 110, y: 191 });
    assert.equal(dots[3].point.y, 191 + 18 / zoom);
    assert(pressedDot(dots, { x: dots[0].point.x - 8 / zoom, y: dots[0].point.y }, zoom));
    assert(!pressedDot(dots, { x: dots[0].point.x - 8.01 / zoom, y: dots[0].point.y }, zoom));
  }
  assert.equal(connectorRoute(o, rect(10, 400, 200)).from.y, 191);
});

for (const [name, target, sides, vertices] of [
  ["side by side", rect(300), ["right", "left"], [[100, 50], [200, 50], [300, 50]]],
  ["above and below", rect(0, 300), ["bottom", "top"], [[50, 100], [50, 200], [50, 300]]],
  ["diagonal perpendicular", rect(180, 150), ["right", "top"], [[100, 50], [124, 50], [230, 50], [230, 126], [230, 150]]],
  ["overlapping same-facing", rect(40), ["left", "left"], [[0, 50], [-12, 50], [8, 50], [28, 50], [40, 50]]],
  ["coincident", rect(), ["left", "left"], [[0, 50], [-12, 50], [0, 50]]],
]) test(`route: ${name} keeps exact vertices and tie order`, () => {
  const route = connectorRoute(rect(), target);
  assert.deepEqual([route.from.side, route.to.side], sides); assert.deepEqual(coordinates(route.vertices), vertices);
  assert(route.vertices.every((p, i, a) => !i || p.x !== a[i - 1].x || p.y !== a[i - 1].y));
  const reverse = connectorRoute(target, rect()); assert.equal(reverse.vertices.length > 0, true);
});

test("lead clamps at 12 and 24, uses d/4 in between, and drops only adjacent equal vertices", () => {
  assert.equal(connectorRoute(rect(), rect()).lead, 12);
  assert.equal(connectorRoute(rect(), rect(300)).lead, 24);
  assert.equal(connectorRoute(rect(), rect(100, 100)).lead, Math.hypot(50, 50) / 4);
  assert.equal(connectorRoute(rect(), rect(300)).vertices.length, 3); // collinear midpoint is retained
  assert.equal(connectorRoute(rect(), rect()).vertices.length, 3); // reversal is retained
});

test("rounded path limits corners by half segments and samples each quadratic 16 times", () => {
  const path = roundedPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 100 }]);
  assert.equal(path.path, "M 0 0 L 5 0 Q 10 0 10 5 L 10 100");
  assert.equal(path.samples.length, 19); assert.deepEqual(path.samples[9], { x: 8.75, y: 1.25 });
  assert.equal(roundedPath([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]).path, "M 0 0 L 1 0 L 1 1");
  assert.match(roundedPath([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]).path, /L 86 0 Q 100 0 100 14/);
  assert.equal(roundedPath([{ x: 0, y: 0 }, { x: -12, y: 0 }, { x: 0, y: 0 }]).path, "M 0 0 L -6 0 Q -12 0 -6 0 L 0 0");
});

test("label point follows total unrounded length and boxes show every plain line", () => {
  assert.deepEqual(halfway([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 300 }]), { x: 100, y: 100 });
  assert.deepEqual(labelBox({ x: 100, y: 100 }, "", measure), rect(55, 83, 90, 34));
  assert.deepEqual(labelBox({ x: 100, y: 100 }, "abcdefghij\n🧭", measure), rect(38, 73.9, 124, 52.2));
  assert.deepEqual(labelEditorBox({ x: 100, y: 100 }, "🧭".repeat(10)), rect(38, 83, 124, 34));
});

test("open arrow points into the chosen side with exact tip and back dimensions", () => {
  for (const side of sideMidpoints(rect())) {
    const [left, tip, right] = arrowPoints(side);
    assert.deepEqual(tip, { x: side.x, y: side.y });
    for (const wing of [left, right]) {
      assert.equal((wing.x - tip.x) * side.normal.x + (wing.y - tip.y) * side.normal.y, 16);
      assert(Math.abs(Math.abs((wing.x - tip.x) * side.normal.y - (wing.y - tip.y) * side.normal.x) - 11.2) < 1e-12);
    }
  }
});

test("drawn bounds include arrow and label, and use exact reversal curve extrema", () => {
  const ends = { from: { object: "a" }, to: { object: "b" }, text: "" };
  const rectangles = new Map([["a", rect()], ["b", rect(300)]]);
  const layout = connectorLayout(ends, rectangles, measure);
  assert.deepEqual(layout.bounds, rect(100, 38.8, 200, 22.400000000000006));
  const labelled = connectorLayout({ ...ends, text: "a".repeat(40) }, rectangles, measure);
  assert.deepEqual(labelled.bounds, rect(-12, 33, 424, 34));
  rectangles.set("b", rect());
  const reversal = connectorLayout(ends, rectangles, measure);
  assert.equal(reversal.bounds.x, -16); // arrow back is farther left than the curve minimum -9
});

test("line and arrow hits include exactly 8 CSS pixels at two zooms and rounded corner samples", () => {
  const b = join(), layout = connector(drawn(b)).connectorLayout;
  const mid = layout.labelPoint;
  for (const zoom of [.5, 2]) {
    assert(lineHit(layout, { x: mid.x, y: mid.y + 8 / zoom }, zoom));
    assert(!lineHit(layout, { x: mid.x, y: mid.y + 8.01 / zoom }, zoom));
    assert(lineHit(layout, layout.arrow[0], zoom));
  }
  const r = connectorRoute(rect(), rect(180, 150)), curve = roundedPath(r.vertices);
  assert(lineHit({ ...layout, samples: curve.samples }, curve.samples[12], 2));
});

test("ideas win over connectors and connector labels win over every other line", () => {
  const b = join(), objects = drawn(b), line = connector(objects);
  assert.equal(hitObject(objects, { x: line.connectorLayout.from.x, y: line.connectorLayout.from.y }, 1).id, line.from.object);
  const labelled = { ...line, text: "label" }, topLine = { ...line, id: "top-line", order: 99 };
  assert.equal(hitObject([labelled, topLine], line.connectorLayout.labelPoint, 1).id, line.id);
  assert.equal(hitObject([line, topLine], line.connectorLayout.labelPoint, 1).id, topLine.id);
  const box = line.connectorLayout.bounds;
  assert(connectorInBox(line.connectorLayout, box));
  assert(!connectorInBox(line.connectorLayout, { ...box, width: box.width - .01 }));
  assert(!connectorInBox(line.connectorLayout, { ...box, x: box.x + .01 }));
});

test("box selection requires the entire labelled connector and keeps rectangle intersection rules", () => {
  const b = join(); connector(b).text = "a long label on the connector";
  const objects = drawn(b), line = connector(objects), box = line.connectorLayout.bounds;
  assert(selectInBox(box, { x: box.x + box.width, y: box.y + box.height }, objects).includes(line.id));
  assert(!selectInBox({ ...box, x: box.x + .01 }, { x: box.x + box.width, y: box.y + box.height }, objects).includes(line.id));
  const idea = objects.find(eligibleIdea);
  assert(selectInBox({ x: idea.x, y: idea.y }, { x: idea.x, y: idea.y }, objects).includes(idea.id));
});

test("delete cascades all attached connectors once and undo/redo preserves IDs, ends, labels and array order", () => {
  let b = join(); b = join(b, b.objects.find(eligibleIdea).id, b.objects.at(-1).id);
  connector(b).text = "leads to";
  const lines = b.objects.filter(hasEnds), first = b.objects.find(eligibleIdea);
  for (const selected of [ids(first), ids(first, ...lines), ids(...b.objects.filter(eligibleIdea))]) {
    const removed = cascade(b.objects, selected); assert.equal(cascadeCount(b.objects, selected), 2);
    const result = deleteObject(b, emptyHistory(), b.objects.filter((o) => selected.has(o.id)));
    assert.deepEqual(new Set(result.affectedIds), removed); assert.equal(result.history.past.length, 1);
    const back = undo(result.board, result.history);
    assert.deepEqual(back.board.objects.map(({ generation, ...o }) => o), b.objects.map(({ generation, ...o }) => o));
    assert(back.board.objects.filter(hasEnds).every((o) => o.generation !== b.objects.find((p) => p.id === o.id).generation));
    const again = redo(back.board, back.history); assert(!again.board.objects.some((o) => removed.has(o.id)));
    validate(back.board); validate(again.board);
  }
  const alone = deleteObject(b, emptyHistory(), lines[0]);
  assert.equal(alone.board.objects.length, b.objects.length - 1); assert.equal(cascadeCount(b.objects, ids(lines[0])), 1);
});

test("copied set includes internal connectors, excludes outside ends and expands selected sections", () => {
  let b = join(), line = connector(b), ideas = b.objects.filter(eligibleIdea);
  assert.deepEqual(copiedSet(b.objects, ids(ideas[0], ideas[1])), ids(ideas[0], ideas[1], line));
  assert.deepEqual(copiedSet(b.objects, ids(ideas[0], line)), ids(ideas[0]));
  assert.equal(copiedSet(b.objects, ids(line)).size, 0);
  assert.equal(copiedSetReason(b.objects, ids(line)), COPY_REASON);
  const section = add(b, "section", 0, 0).objects.at(-1);
  b = assignSection(placeObject(b, section), ids(ideas[0], ideas[1]), section.id);
  assert(copiedSet(b.objects, ids(section)).has(line.id));
  const emptySection = { ...section, id: crypto.randomUUID() };
  assert.equal(copiedSetReason([...b.objects, emptySection], ids(emptySection)), "");
  assert.deepEqual(copiedSet([...b.objects, emptySection], ids(emptySection)), ids(emptySection));
});

test("snapshot and duplicate remap connector ends to fresh copies and offset rectangles only", () => {
  const b = join(), ideas = b.objects.filter(eligibleIdea), line = connector(b);
  line.text = "leads to";
  const snapshot = buildSnapshot(b, ids(ideas[0], ideas[1]), drawn(b));
  assert.equal(snapshot.objects.length, 3); assert.notEqual(connector(snapshot).from, line.from);
  const pasted = buildPaste(b, snapshot, { centerX: 0, centerY: 0, zoom: 1, width: 1280, height: 800 });
  const duplicated = duplicate(b, emptyHistory(), [ideas[0], ideas[1]]);
  for (const result of [pasted, duplicated]) {
    const copies = result.board.objects.filter((o) => !b.objects.some((old) => old.id === o.id));
    assert.equal(copies.length, 3); const copy = connector(copies), ends = copies.filter(eligibleIdea);
    assert.deepEqual([copy.from.object, copy.to.object], ends.map((o) => o.id));
    assert.equal(copy.text, line.text); assert(!("x" in copy));
    assert(ends.every((o, i) => o.x === ideas[i].x + 24 && o.y === ideas[i].y + 24));
    assert(copies.every((o) => !b.objects.some((old) => old.id === o.id || old.generation === o.generation)));
    validate(result.board);
  }
});

test("three bands insert connectors last in their band and order commands undo an interleaved array exactly", () => {
  let b = join(); b = join(b, connector(b).to.object, connector(b).from.object);
  const section = add(b, "section", 0, 0).objects.at(-1); b = placeObject(b, section);
  const ordered = bands(b.objects); assert.deepEqual(ordered.map((o) => hasEnds(o) ? 1 : o.id === section.id ? 0 : 2), [0, 1, 1, 2, 2, 2]);
  assert.equal(b.objects[2].id, b.objects.filter(hasEnds).at(-1).id);
  const interleaved = { ...b, objects: [b.objects[3], b.objects[1], b.objects[0], b.objects[4], b.objects[2], b.objects[5]].map((o, order) => ({ ...o, order })) };
  const line = connector(interleaved), selected = ids(line);
  for (const command of ["Bring to front", "Bring forward", "Send backward", "Send to back"]) {
    const next = { ...interleaved, objects: orderInBands(command, interleaved.objects, selected) };
    const history = record(emptyHistory(), interleaved, next, [...selected]);
    assert.equal(canonical(undo(next, history).board), canonical(interleaved));
    assert.deepEqual(next.objects.filter(eligibleIdea).map((o) => o.id), interleaved.objects.filter(eligibleIdea).map((o) => o.id));
  }
  const added = createConnector(interleaved, b.objects[3].id, b.objects[4].id).board;
  const back = undo(added, record(emptyHistory(), interleaved, added));
  assert.deepEqual(back.board.objects, interleaved.objects);
});

test("Connect reasons count exactly two eligible selected ideas with editing and limit precedence", () => {
  const b = join(), ideas = b.objects.filter(eligibleIdea), line = connector(b);
  for (const selected of [ids(ideas[0]), ids(...ideas), ids(ideas[0], line), ids(line)]) assert.equal(connectReason(b, selected, editable), "Select exactly two ideas to connect.");
  const section = add(b, "section", 0, 0).objects.at(-1);
  assert.equal(connectReason({ ...b, objects: [...b.objects, section] }, ids(ideas[0], section), editable), "Select exactly two ideas to connect.");
  assert.equal(connectReason(b, ids(ideas[0], ideas[1]), editable), "");
  assert.equal(connectReason({ ...b, objects: Array(250).fill(ideas[0]) }, ids(ideas[0], ideas[1]), editable), "Select exactly two ideas to connect.");
  const full = { ...b, objects: [...b.objects, ...Array(250 - b.objects.length).fill(ideas[2])] };
  assert.equal(connectReason(full, ids(ideas[0], ideas[1]), editable), "250 object limit reached");
  assert.throws(() => createConnector(full, ideas[0].id, ideas[1].id), /250/);
  assert.match(connectReason(b, ids(ideas[0], ideas[1]), { ...editable, readOnly: true }), /read-only/i);
  assert.throws(() => duplicate(full, emptyHistory(), [ideas[0], ideas[1]]), /250/);
  const snapshot = buildSnapshot(b, ids(ideas[0], ideas[1]), drawn(b));
  assert.throws(() => buildPaste(full, snapshot, { centerX: 0, centerY: 0, zoom: 1, width: 1280, height: 800 }), /250/);
});

test("Objects connector numbers and names reference idea numbers separately from sections", () => {
  let b = join(); const line = connector(b); line.text = "leads to";
  assert.equal(objectLabel(b, line, new Map()), "connector 1 · leads to · sticky 1 to square 2");
  b = join(b, line.to.object, line.from.object);
  assert.equal(objectLabel(b, b.objects.filter(hasEnds)[1], new Map()), "connector 2 · Empty · square 2 to sticky 1");
  assert.equal(objectLabel(b, b.objects.filter(eligibleIdea)[2], new Map()), "text 3 · Empty");
});

test("moving, membership, wrapping, grouping and arrangement leave connectors out", () => {
  const b = join(), line = connector(b), selected = ids(...b.objects), ideas = b.objects.filter(eligibleIdea);
  assert.equal(moveWithMembers(b, ids(line), 10, 10), b);
  assert.deepEqual(connector(moveWithMembers(b, selected, 10, 20)), line);
  const grouped = groupObjects(b, selected); assert.equal(connector(grouped).group, null);
  assert(grouped.objects.filter(eligibleIdea).every((o) => o.group !== null));
  assert.equal(groupReason("Group", b, ids(line), editable), FOLLOW_REASON);
  const section = add(b, "section", 0, 0).objects.at(-1), placed = placeObject(b, section);
  assert.equal(connector(placed).section, null);
  assert.equal(connector(assignSection(placed, selected, section.id)).section, null);
  assert.equal(connector(wrapSelection(b, selected, drawn(b)).board).section, null);
  assert.equal(arrangeReason("Align objects left", drawn(b).filter(hasEnds), editable), FOLLOW_REASON);
  assert.equal(arrangeReason("Distribute horizontally", drawn(b).filter(hasEnds), editable), FOLLOW_REASON);
  assert.deepEqual(arrangePositions("Align objects left", drawn(b)).map((o) => o.id), ideas.map((o) => o.id));
});

test("clipboard reasons refuse connector-only selections after editing reasons", () => {
  const b = join(), line = connector(b);
  for (const command of ["Copy", "Cut"]) {
    assert.equal(clipboardReason(command, ids(line), null, editable, b.objects), COPY_REASON);
    assert.notEqual(clipboardReason(command, ids(line), null, { ...editable, composing: true }, b.objects), COPY_REASON);
  }
  assert.throws(() => duplicate(b, emptyHistory(), line), new RegExp(COPY_REASON.replace(".", "\\.")));
});

// Exercise the actual hooks with React's server renderer; no browser or DOM is launched.
const { build } = await import("esbuild");
const reactURL = new URL("../node_modules/react/index.js", import.meta.url);
const { createElement } = await import(reactURL.href);
const { renderToStaticMarkup } = await import("react-dom/server");
const compiled = await build({ stdin: { contents: `
  export { useEditingCommands } from "./state/use-editing-commands.ts";
  export { useBoardDocument } from "./state/use-board-document.ts";
  export { useGeometryEdits } from "./state/use-geometry-edits.ts";
  export { useCanvasInput } from "./state/use-canvas-input.ts";
  export { ConnectorControls } from "./ui/connector-controls.tsx";
  export { ObjectsPanel } from "./ui/objects-panel.tsx";
  export { ContentField } from "./ui/content-field.tsx";
`, resolveDir: new URL("../apps/web/src/", import.meta.url).pathname, loader: "ts" },
  bundle: true, write: false, platform: "node", format: "esm", plugins: [{ name: "shared-react", setup(build) {
    build.onResolve({ filter: /^(react(?:\/.*)?|yjs)$/ }, (args) => ({ path: args.path === "react" ? reactURL.href :
      new URL(args.path === "yjs" ? "../node_modules/yjs/dist/yjs.mjs" : "../node_modules/" + args.path + ".js", import.meta.url).href, external: true }));
  } }] });
const hooks = await import("data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].text).toString("base64"));
function harness(b, selected = ids(...b.objects), options = {}) {
  let result;
  renderToStaticMarkup(createElement(function Harness() {
    const doc = hooks.useBoardDocument({ readOnly: false, setStatus() {} }); doc.model.current = b;
    const events = { selection: [...selected], message: "", inline: false, tool: "Select", focus: "" }, editor = { current: null };
    const surface = { getBoundingClientRect: () => ({ left: 0, top: 0, right: 1280, bottom: 800 }), focus() { events.focus = "scene"; },
      setPointerCapture() {}, hasPointerCapture: () => false };
    const layouts = new Map(drawn(b).map((o) => [o.id, { height: o.displayHeight }]));
    const common = { ...doc, selected, editor, select: (value) => { events.selection = typeof value === "string" ? [value] : [...value]; },
      setMessage: (s) => { events.message = s; }, setInline: (v) => { events.inline = v; }, setPanel() {},
      setTool: (s) => { events.tool = s; }, selector: { current: { focus() { events.focus = "objects"; } } }, scene: { current: surface }, view: { x: 0, y: 0, z: 1 },
      readOnly: false, busy: false, composing: false, lineCount: () => 1, objectLayouts: layouts, ...options };
    const commands = hooks.useEditingCommands({ ...common, messageSequence: { current: 0 }, alive: { current: true },
      displayedObjects: drawn(b), commandReason: "", selectionReason: "", clipboardState: editable, editingState: editable,
      arrangementMembers: drawn(b).filter((o) => selected.has(o.id)), growAvailable: false, growHeight: 0 });
    const geometry = hooks.useGeometryEdits({ ...common, item: b.objects.find((o) => selected.has(o.id)), setStatus() {} });
    const drag = { current: null };
    const canvas = hooks.useCanvasInput({ ...common, ...geometry, drag, clearHistory() {}, setView() {}, trackPointer() {},
      size: { w: 1280, h: 800 }, setBusy() {}, spacePanRef: { current: false }, setSpacePan() {}, setSelectionBox() {},
      tool: "Select", inline: false, textEditing: false, invalidObjectText: false,
      handlesVisible: false, handlePoints: [], displayedObjects: drawn(b), edit() {}, ...options });
    result = { doc, commands, geometry, canvas, drag, events, surface }; return null;
  }));
  return result;
}
function pointer(h, x, y) {
  return { target: h.surface, currentTarget: h.surface, clientX: x + 640, clientY: y + 400,
    pointerId: 1, button: 0, preventDefault() {} };
}

test("actual Connect uses reading order, selects a closed connector and undoes in one step", () => {
  const b = base(), [a, z] = b.objects, h = harness(b, new Set([z.id, a.id]));
  assert.equal(h.commands.arrangementReason("Connect"), ""); h.commands.arrange("Connect", true);
  const line = connector(h.doc.model.current);
  assert.deepEqual([line.from.object, line.to.object], [a.id, z.id]);
  assert.deepEqual(h.events.selection, [line.id]); assert.equal(h.events.inline, false);
  assert.equal(h.events.focus, "objects");
  assert.equal(h.doc.historyRef.current.past.length, 1);
  h.commands.command("Undo"); assert(!h.doc.model.current.objects.some(hasEnds));
  h.commands.command("Redo"); assert.equal(connector(h.doc.model.current).id, line.id);
  h.doc.adapter.current.destroy();
});

test("dots show only on selected ideas and hide during text entry, pan and pointer gestures", () => {
  let b = join(); const section = add(b, "section", 0, 0).objects.at(-1); b = placeObject(b, section);
  for (const selected of [ids(section), ids(connector(b))]) {
    const h = harness(b, selected); assert.equal(h.canvas.dotsVisible, false); assert.deepEqual(h.canvas.dots, []);
    h.doc.adapter.current.destroy();
  }
  const mixed = harness(b); assert.equal(mixed.canvas.dots.length, 12); mixed.doc.adapter.current.destroy();
  for (const options of [{ readOnly: true }, { inline: true }, { composing: true }, { textEditing: true },
    { busy: true }, { spacePanRef: { current: true } }, { tool: "Pan" }]) {
    const h = harness(b, ids(...b.objects), options); assert.equal(h.canvas.dotsVisible, false); h.doc.adapter.current.destroy();
  }
});

test("actual dot target excludes sections and the 250 limit refuses creation without a history step", () => {
  let b = base(); const section = add(b, "section", 0, -300).objects.at(-1); b = placeObject(b, section);
  assert.equal(connectionTarget(drawn(b), b.objects.find(eligibleIdea).id, { x: section.x + 10, y: section.y + 10 }), null);
  while (b.objects.length < 250) b = add(b, "text", -5000, -5000);
  const [a, z] = b.objects.filter(eligibleIdea), h = harness(b, ids(a));
  const dot = h.canvas.dots.find((d) => d.side === "right");
  h.canvas.pointerDown(pointer(h, dot.point.x, dot.point.y)); h.canvas.pointerUp(pointer(h, z.x + 20, z.y + 20));
  assert.match(h.events.message, /250 object limit/); assert.equal(h.doc.model.current.objects.length, 250);
  assert.equal(h.doc.historyRef.current.past.length, 0); h.doc.adapter.current.destroy();
});

test("routes follow endpoint resizing and section-carried ideas without recording the connector", () => {
  let b = join(); const line = connector(b), before = connector(drawn(b)).connectorLayout;
  const resized = { ...b, objects: b.objects.map((o) => o.id === line.from.object ? { ...o, width: o.width + 200 } : o) };
  assert.notDeepEqual(connector(drawn(resized)).connectorLayout.vertices, before.vertices);
  assert.deepEqual(connector(resized), line);
  const history = record(emptyHistory(), b, resized);
  assert(history.past[0].changes.every((c) => !hasEnds(c.before ?? c.after)));
  assert.equal(canonical(undo(resized, history).board), canonical(b));
  const section = add(b, "section", 0, 0).objects.at(-1); b = placeObject(b, section);
  const member = b.objects.find((o) => o.id === line.from.object);
  const moved = moveWithMembers(b, ids(section, member, line), 20, 30);
  assert.equal(moved.objects.find((o) => o.id === member.id).x, member.x + 20);
  assert.deepEqual(connector(moved), connector(b));
  assert.notDeepEqual(connector(drawn(moved)).connectorLayout.vertices, connector(drawn(b)).connectorLayout.vertices);
});

test("actual dot drag needs only its source, previews its target, creates once and cancels invalid drops", () => {
  for (const target of ["target", "empty", "source", "outside", "cancel", "lost"]) {
    const b = base(), a = b.objects[0], z = b.objects[1], h = harness(b, ids(a));
    const dot = h.canvas.dots.find((d) => d.side === "right"); assert(dot);
    h.canvas.pointerDown(pointer(h, dot.point.x, dot.point.y)); assert(h.drag.current.connection);
    const p = target === "target" ? { x: z.x + 40, y: z.y + 40 } : target === "source" ? a : target === "outside" ? { x: 2000, y: 2000 } : { x: 200, y: 300 };
    h.canvas.pointerMove(pointer(h, p.x, p.y));
    if (target === "target") assert.equal(h.drag.current.connection.target, z.id);
    if (target === "cancel") h.canvas.cancel();
    else if (target === "lost") h.canvas.lostPointerCapture();
    else h.canvas.pointerUp(pointer(h, p.x, p.y));
    assert.equal(h.doc.model.current.objects.filter(hasEnds).length, target === "target" ? 1 : 0);
    assert.equal(h.drag.current, null); assert.equal(h.events.message, "");
    h.doc.adapter.current.destroy();
  }
});

test("actual connector-only Copy, Cut and Duplicate leave board, history, clipboard and selection intact", () => {
  const b = join(), line = connector(b), h = harness(b, ids(line)), before = canonical(b);
  for (const command of ["Copy", "Cut", "Duplicate"]) {
    if (command === "Duplicate") h.commands.command(command); else h.commands.clipboardCommand(command);
    assert.equal(h.events.message, COPY_REASON); assert.equal(canonical(h.doc.model.current), before);
    assert.equal(h.doc.historyRef.current.past.length, 0); assert.equal(h.commands.objectClipboard, null);
    assert.deepEqual(h.events.selection, [line.id]);
  }
  h.doc.adapter.current.destroy();
});

test("actual Cut and Delete cascade notices count every removed connector and undo restores the whole step", () => {
  const b = join(), line = connector(b), a = b.objects.find((o) => o.id === line.from.object);
  for (const command of ["Delete", "Cut"]) for (const selected of [ids(a), ids(a, line)]) {
    const h = harness(b, selected); h.commands.command(command);
    assert.match(h.events.message, / 1 connector removed with the ideas\.$/);
    assert(!h.doc.model.current.objects.some(hasEnds)); assert.equal(h.doc.historyRef.current.past.length, 1);
    h.commands.command("Undo"); assert.deepEqual(connector(h.doc.model.current).from, line.from);
    h.commands.command("Redo"); assert(!h.doc.model.current.objects.some(hasEnds));
    h.doc.adapter.current.destroy();
  }
});

test("actual label sessions, style, geometry and arrange commands preserve connector records", () => {
  const b = join(); b.objects.filter(eligibleIdea).forEach((o) => { o.text = "Idea"; });
  const line = connector(b), h = harness(b), before = structuredClone(line);
  h.commands.changeStyle("color", "teal"); h.commands.changeStyle("textSize", "large"); h.commands.changeStyle("align", "right");
  globalThis.document = { activeElement: null };
  try { h.commands.toggleFormat("bold"); } finally { delete globalThis.document; }
  h.commands.shapeCommands.changeShape("circle");
  h.commands.shapeCommands.changeFill({ color: "blue" }); h.commands.shapeCommands.changeBorder({ style: "dashed" });
  h.geometry.move(10, 20); h.geometry.resizeBy(10, 10); h.commands.arrange("Align objects left"); h.commands.arrange("Group");
  assert.deepEqual(connector(h.doc.model.current), before);
  const label = harness(b, ids(line)); label.doc.beginTextSession(line);
  label.geometry.commitText(line.id, "leads"); label.geometry.commitText(line.id, "leads to"); label.doc.finishTextSession();
  assert.equal(label.doc.historyRef.current.past.length, 1);
  assert.deepEqual(connector(label.doc.model.current), { ...line, text: "leads to" });
  label.commands.command("Undo"); assert.deepEqual(connector(label.doc.model.current), line);
  label.commands.command("Redo"); assert.equal(connector(label.doc.model.current).text, "leads to");
  h.doc.adapter.current.destroy(); label.doc.adapter.current.destroy();
});

test("actual dragging a connector selects it without moving it or starting a marquee", () => {
  const b = join(), line = connector(drawn(b)), p = line.connectorLayout.labelPoint, h = harness(b, ids(line));
  h.canvas.pointerDown(pointer(h, p.x, p.y)); h.canvas.pointerMove(pointer(h, p.x + 60, p.y + 60)); h.canvas.pointerUp(pointer(h, p.x + 60, p.y + 60));
  assert.equal(canonical(h.doc.model.current), canonical(b)); assert.equal(h.doc.historyRef.current.past.length, 0);
  assert.deepEqual(h.events.selection, [line.id]); h.doc.adapter.current.destroy();
});

test("connector context controls and Name field expose the fixed keyboard routes", () => {
  const props = { objects: [connector(join())], commands: { style() {} }, popup: { open: "", controls: {}, buttons: {} }, count: 1, empty: true, reason: "", edit() {}, remove() {} };
  const emptyBar = renderToStaticMarkup(createElement(hooks.ConnectorControls, props));
  assert.match(emptyBar, />Connector</); assert.match(emptyBar, />Add text</); assert.match(emptyBar, /aria-label="Delete"/);
  assert.doesNotMatch(emptyBar, /Arrange|Duplicate|Formatting/);
  assert.match(emptyBar, /Colour: Dark gray/); assert.match(emptyBar, /Line style: Thin, Solid/);
  assert.match(emptyBar, /Start point: None/); assert.match(emptyBar, /Line shape: Elbowed/); assert.match(emptyBar, /End point: Line arrow/);
  const labelled = renderToStaticMarkup(createElement(hooks.ConnectorControls, { ...props, empty: false }));
  assert.doesNotMatch(labelled, />Add text</);
  const multi = renderToStaticMarkup(createElement(hooks.ConnectorControls, { ...props, count: 2 }));
  assert.match(multi, />2 connectors</); assert.doesNotMatch(multi, />Add text</);
  const field = renderToStaticMarkup(createElement(hooks.ContentField, { item: connector(join()), text: "", editor: { current: null } }));
  assert.match(field, />Name</); assert.match(field, /100 code points/);
  let changed, selection = "editing", inline = true, finished = false;
  const draft = "🧭".repeat(101);
  const element = hooks.ContentField({ item: connector(join()), text: draft, inline: true,
    changeText: (value) => { changed = value; }, setTextSelection: (value) => { selection = value; },
    finishTextSession: () => { finished = true; }, setInline: (value) => { inline = value; } });
  const textarea = element.props.children.find((child) => child.type === "textarea");
  assert.equal(textarea.props.value, draft);
  textarea.props.onChange({ target: { value: draft } }); assert.equal(changed, draft);
  textarea.props.onKeyDown({ key: "Escape", nativeEvent: {}, preventDefault() {}, stopPropagation() {} });
  assert.equal(selection, null); assert.equal(inline, false); assert.equal(finished, true);
});
