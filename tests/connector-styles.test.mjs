// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { add, empty, validate, canonical, upgrade, Adapter } from "../apps/web/src/document.ts";
import { defaultConnectorStyle, connectorStyleOf, CONNECTOR_STYLE_KEYS, HEADS, LINE_SHAPES, END_SIDES,
  SHAPE_COLORS, hasEnds, hasRectangle, eligibleIdea, lineWidth, lineDash, outlinePoint, objectKeys } from "../apps/web/src/objects/registry.ts";
import { connectorRoute, roundedPath, arrowPoints, halfway, connectorLayout, reconnectPreview, lineHit, connectorInBox,
  createConnector, changeConnectorStyle, reconnect } from "../apps/web/src/connectors.ts";
import { connectorHead } from "../apps/web/src/connector-heads.ts";
import { curvedPath, straightPath, shortenPath, curvePoint } from "../apps/web/src/connector-path.ts";
import { dropSide, pressedEnd, reconnectTarget, connectionDots } from "../apps/web/src/connection-drag.ts";
import { emptyHistory, record, undo, redo, duplicate, deleteObject } from "../apps/web/src/history.ts";
import { buildSnapshot, buildPaste } from "../apps/web/src/clipboard.ts";
import { makeStroke } from "../apps/web/src/strokes.ts";
import { placeObject, objectLabel, moveWithMembers } from "../apps/web/src/sections.ts";

const defaults = defaultConnectorStyle(), measure = (s) => Array.from(s).length * 10;
const near = (a, b, tolerance = 1e-8) => assert(Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);
const pointNear = (a, b) => { near(a.x, b.x); near(a.y, b.y); };
const rect = (x = 0, y = 0, width = 100, height = 100) => ({ x, y, width, height });
const base = () => add(add(add({ ...empty(), title: "Synthetic relationships" }, "sticky", 0, 0), "shape", 500, 100), "text", 0, 400);
const ideas = (b) => b.objects.filter(eligibleIdea), line = (b) => b.objects.find(hasEnds);
const joined = (style = defaults) => { const b = base(), [a, z] = ideas(b); return createConnector(b, a.id, z.id, style).board; };
const selection = (...objects) => new Set(objects.map((o) => o.id));
const rectangles = (b) => new Map(b.objects.filter(hasRectangle).map((o) => [o.id, { ...o, displayHeight: o.height }]));
const layout = (b) => connectorLayout(line(b), rectangles(b), measure);
const changed = (b, change) => ({ ...b, objects: b.objects.map((o) => hasEnds(o) ? { ...o, ...change } : o) });
function oldVersion(b, version) {
  return { ...b, schemaVersion: version, objects: b.objects.filter((o) => version >= 7 || !hasEnds(o)).map((o, order) => {
    const old = { ...o, order };
    if (version < 9) for (const key of CONNECTOR_STYLE_KEYS) delete old[key];
    if (version < 6) for (const key of ["shape", "fill", "border"]) delete old[key];
    if (version < 5) delete old.section;
    if (version < 4) delete old.marks;
    if (version < 3) delete old.group;
    if (version < 2) for (const key of ["color", "textSize", "align"]) delete old[key];
    return old;
  }) };
}

test("v9 requires exact ordered connector keys, canonical ends and every style value", () => {
  const b = joined();
  assert.equal(b.schemaVersion, 10);
  const bytes = canonical(b), parsed = JSON.parse(bytes), c = line(parsed);
  assert.deepEqual(Object.keys(c), ["id", "generation", "type", "text", "color", "textSize", "align", "group", "marks", "section", "from", "to", ...CONNECTOR_STYLE_KEYS, "order"]);
  assert.deepEqual(Object.keys(c.from), ["object", "anchor"]);
  assert.deepEqual(Object.keys(c), objectKeys(c.type, 9));
  const values = { lineColor: [...SHAPE_COLORS.map((c) => c.name), "#12abef"], lineWeight: ["thin", "thick"], lineDash: ["solid", "dashed"], startHead: HEADS, endHead: HEADS, lineShape: LINE_SHAPES };
  for (const key of CONNECTOR_STYLE_KEYS) {
    for (const value of values[key]) {
      const next = changed(b, { [key]: value });
      assert.equal(canonical(validate(JSON.parse(canonical(next)))), canonical(next));
    }
    const missing = structuredClone(b); delete line(missing)[key]; assert.throws(() => validate(missing), key);
    for (const invalid of [null, 4, [], {}, "unknown", ""]) assert.throws(() => validate(changed(b, { [key]: invalid })), `${key}: ${invalid}`);
    const other = structuredClone(b); ideas(other)[0][key] = defaults[key]; assert.throws(() => validate(other));
  }
  for (const invalid of ["#ABCDEF", "#abcdef0", "#abc", "#12aBef"]) assert.throws(() => validate(changed(b, { lineColor: invalid })));
  for (const end of ["from", "to"]) for (const side of END_SIDES) {
    const next = changed(b, { [end]: { ...line(b)[end], anchor: side } }); assert.doesNotThrow(() => validate(next));
  }
});

test("v9 rejects dangling, same-idea and stroke ends; legacy connectors reject style and pinned anchors", () => {
  const b = joined(), stroke = makeStroke(b, [{ x: 700, y: 0 }, { x: 730, y: 10 }], { kind: "marker", color: "black", weight: "thin" }, true);
  const withStroke = placeObject(b, stroke);
  for (const object of [line(b).to.object, crypto.randomUUID(), stroke.id]) assert.throws(() => validate(changed(withStroke, { from: { object, anchor: "left" } })));
  for (const version of [7, 8]) {
    const old = oldVersion(b, version); assert.doesNotThrow(() => canonical(old));
    for (const key of CONNECTOR_STYLE_KEYS) assert.throws(() => validate(changed(old, { [key]: defaults[key] })));
    for (const end of ["from", "to"]) for (const anchor of END_SIDES.slice(1)) assert.throws(() => validate(changed(old, { [end]: { ...line(old)[end], anchor } })));
  }
});

for (const version of [1, 2, 3, 4, 5, 6, 7, 8]) test(`v${version} keeps exact canonical bytes and upgrades in memory without mutation`, () => {
  let b = joined();
  // Use only the rectangle types supported by every version.
  b.objects = b.objects.filter((o) => o.type !== "shape");
  b.objects = b.objects.map((o, order) => hasEnds(o) ? { ...o, to: { object: ideas(b)[1].id, anchor: "auto" }, order } : { ...o, order });
  const old = oldVersion(b, version), bytes = canonical(old), before = structuredClone(old);
  const decoded = validate(JSON.parse(bytes)), current = upgrade(decoded);
  assert.equal(canonical(decoded), bytes); assert.deepEqual(old, before); assert.equal(current.schemaVersion, 10);
  assert.equal(upgrade(current), current);
  for (const c of current.objects.filter(hasEnds)) {
    assert.deepEqual(connectorStyleOf(c), defaults); assert.equal(c.from.anchor, "auto"); assert.equal(c.to.anchor, "auto");
    const stripped = { ...c }; for (const key of CONNECTOR_STYLE_KEYS) delete stripped[key]; assert.deepEqual(stripped, line(old));
  }
});

test("styled pinned canonical records round-trip byte for byte, independently of property insertion order", () => {
  const b = joined({ ...defaults, lineColor: "#123abc", lineWeight: "thick", lineDash: "dashed", startHead: "diamond", endHead: "circle", lineShape: "curved" });
  line(b).text = "leads to\n🧭"; line(b).from.anchor = "left"; line(b).to.anchor = "bottom";
  const bytes = canonical(b); assert.equal(canonical(validate(JSON.parse(bytes))), bytes);
  const reverse = { ...b, objects: b.objects.map((o) => Object.fromEntries(Object.entries(o).reverse())) };
  assert.equal(canonical(reverse), bytes);
});

test("the adapter stores one atomic connectorStyle beside atomic ends, and recreates both", () => {
  const b = joined(), c = line(b), adapter = new Adapter(); adapter.set(b);
  const map = adapter.doc.getMap("objects").get(c.id), events = [];
  for (const key of CONNECTOR_STYLE_KEYS) assert.equal(map.has(key), false);
  assert.deepEqual(map.get("connectorStyle"), defaults); assert.deepEqual(map.get("ends"), { from: c.from, to: c.to });
  assert.equal(adapter.doc.getMap("objects").get(c.from.object).has("connectorStyle"), false);
  map.observe((event) => events.push([...event.keysChanged]));
  let next = changeConnectorStyle(b, selection(c), "startHead", "diamond"); adapter.set(next);
  assert.deepEqual(events, [["connectorStyle"]]);
  next = reconnect(next, c.id, "from", { object: ideas(b)[2].id, anchor: "top" }); adapter.set(next);
  assert.deepEqual(events, [["connectorStyle"], ["ends"]]);
  const projection = { ...line(next), ...map.get("ends"), ...map.get("connectorStyle"), text: map.get("text").toString() };
  assert.deepEqual(projection, line(next));
  const recreated = new Adapter(); recreated.set(validate(JSON.parse(canonical(next))));
  assert.deepEqual(recreated.doc.getMap("objects").get(c.id).get("connectorStyle"), map.get("connectorStyle"));
  assert.deepEqual(recreated.doc.getMap("objects").get(c.id).get("ends"), map.get("ends"));
  adapter.destroy(); recreated.destroy();
});

test("style and reconnect Undo/Redo restore whole labelled connector identities and save bytes", () => {
  const b = changed(joined(), { text: "leads to" }), c = line(b);
  const styled = changeConnectorStyle(b, selection(c), "lineShape", "curved");
  const moved = reconnect(styled, c.id, "to", { object: ideas(b)[2].id, anchor: "bottom" });
  let history = record(record(emptyHistory(), b, styled), styled, moved);
  const back = undo(moved, history); assert.equal(canonical(back.board), canonical(styled));
  const original = undo(back.board, back.history); assert.equal(canonical(original.board), canonical(b));
  const again = redo(original.board, original.history), last = redo(again.board, again.history);
  assert.equal(canonical(last.board), canonical(moved)); assert.equal(line(last.board).generation, c.generation);
  const deleted = deleteObject(moved, last.history, ideas(moved)[0]);
  const restored = undo(deleted.board, deleted.history);
  assert.equal(line(restored.board).id, c.id); assert.notEqual(line(restored.board).generation, c.generation);
  assert.deepEqual(connectorStyleOf(line(restored.board)), connectorStyleOf(line(moved)));
  assert.deepEqual(line(restored.board).to, line(moved).to);
});

test("pinned sides restrict the candidate pairs and preserve v19 tie order", () => {
  for (const anchor of END_SIDES.slice(1)) {
    const route = connectorRoute(rect(), rect(300, 200), anchor);
    assert.equal(route.from.side, anchor);
    const available = ["left", "right", "top", "bottom"].map((side) => connectorRoute(rect(), rect(300, 200), anchor, side));
    assert(available.some((r) => r.to.side === route.to.side));
  }
  const both = connectorRoute(rect(), rect(300, 200), "top", "bottom");
  assert.deepEqual([both.from.side, both.to.side], ["top", "bottom"]);
  const tied = connectorRoute(rect(), rect()); assert.deepEqual([tied.from.side, tied.to.side], ["left", "left"]);
  assert.equal(connectorRoute(rect(), rect(), "right").to.side, "right");
});

test("default layout keeps today's rounded route, chevron, label and bounds exactly", () => {
  const object = { ...defaults, from: { object: "a", anchor: "auto" }, to: { object: "b", anchor: "auto" }, text: "" };
  const boxes = new Map([["a", rect()], ["b", rect(300)]]), drawn = connectorLayout(object, boxes, measure);
  const route = connectorRoute(rect(), rect(300));
  assert.deepEqual(drawn.vertices, route.vertices); assert.equal(drawn.path, roundedPath(route.vertices).path);
  assert.deepEqual(drawn.arrow, arrowPoints(route.to)); assert.deepEqual(drawn.labelPoint, halfway(route.vertices));
  assert.deepEqual(drawn.bounds, rect(100, 38.8, 200, 22.400000000000006));
  const withHeads = connectorLayout({ ...object, startHead: "circle", endHead: "diamond" }, boxes, measure);
  assert.deepEqual(withHeads.labelPoint, drawn.labelPoint);
});

test("Curved control points use reach 24 nearby and half the endpoint distance otherwise", () => {
  const close = curvedPath({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 0 });
  assert.deepEqual(close.segments[0].points, [{ x: 0, y: 0 }, { x: 0, y: -24 }, { x: 34, y: 0 }, { x: 10, y: 0 }]);
  const far = curvedPath({ x: 0, y: 0 }, { x: 60, y: 80 }, { x: 1, y: 0 }, { x: 0, y: 1 });
  assert.deepEqual(far.segments[0].points[1], { x: 50, y: 0 }); assert.deepEqual(far.segments[0].points[2], { x: 60, y: 130 });
  assert.equal(far.samples.length, 257);
});

const outlines = [
  { type: "sticky", ...rect() },
  { type: "shape", shape: "square", ...rect() },
  { type: "shape", shape: "circle", ...rect(0, 0, 120, 80) },
];
test("Straight clips rectangles, rounded corners and ellipses, ignores saved anchors, and defines coincident centres", () => {
  pointNear(outlinePoint(outlines[0], { x: 250, y: 150 }).point, { x: 100, y: 75 });
  const corner = outlinePoint(outlines[1], { x: 150, y: 150 });
  pointNear(corner.point, { x: 94 + 6 / Math.SQRT2, y: 94 + 6 / Math.SQRT2 }); pointNear(corner.normal, { x: Math.SQRT1_2, y: Math.SQRT1_2 });
  const ellipse = outlinePoint(outlines[2], { x: 200, y: 150 }).point;
  near(((ellipse.x - 60) / 60) ** 2 + ((ellipse.y - 40) / 40) ** 2, 1);
  for (const a of outlines) {
    const z = { ...a, x: 300, y: 200 }, boxes = new Map([["a", a], ["b", z]]);
    const object = { ...defaults, lineShape: "straight", text: "", from: { object: "a", anchor: "top" }, to: { object: "b", anchor: "top" } };
    const path = connectorLayout(object, boxes, measure), auto = connectorLayout({ ...object, from: { ...object.from, anchor: "auto" }, to: { ...object.to, anchor: "left" } }, boxes, measure);
    assert.equal(path.path, auto.path); pointNear(path.from, outlinePoint(a, { x: z.x + z.width / 2, y: z.y + z.height / 2 }).point);
  }
  const object = { ...defaults, lineShape: "straight", text: "", from: { object: "a", anchor: "auto" }, to: { object: "b", anchor: "auto" } };
  const same = connectorLayout(object, new Map([["a", rect()], ["b", rect()]]), measure);
  pointNear(same.from, { x: 100, y: 50 }); pointNear(same.to, { x: 0, y: 50 });
});

for (const weight of ["thin", "thick"]) test(`head table, fill, insets and outward extents at ${weight} weight`, () => {
  const s = weight === "thin" ? 1 : 1.6, p = { x: 100, y: 50 }, n = { x: 1, y: 0 };
  const shapes = Object.fromEntries(HEADS.map((kind) => [kind, connectorHead(kind, p, n, weight)]));
  assert.deepEqual(shapes.none.points, []); assert.equal(shapes.none.inset, 0);
  assert.deepEqual(shapes["line-arrow"].points, [{ x: 100 + 16 * s, y: 50 + 11.2 * s }, p, { x: 100 + 16 * s, y: 50 - 11.2 * s }]);
  assert.equal(shapes["line-arrow"].filled, false); assert.equal(shapes["line-arrow"].inset, 0);
  assert.deepEqual(shapes["solid-arrow"].points, [p, { x: 100 + 18 * s, y: 50 + 10 * s }, { x: 100 + 18 * s, y: 50 - 10 * s }]);
  assert.deepEqual(shapes.triangle.points, [{ x: 100, y: 50 + 10 * s }, { x: 100 + 18 * s, y: 50 }, { x: 100, y: 50 - 10 * s }]);
  assert.deepEqual(shapes.circle.circle, { x: 100 + 8 * s, y: 50, radius: 8 * s });
  assert.deepEqual(shapes.diamond.points, [p, { x: 100 + 10 * s, y: 50 + 9 * s }, { x: 100 + 20 * s, y: 50 }, { x: 100 + 10 * s, y: 50 - 9 * s }]);
  for (const [head, inset] of [["solid-arrow", 18], ["triangle", 18], ["circle", 16], ["diamond", 20]]) {
    assert.equal(shapes[head].inset, inset * s); assert.equal(shapes[head].filled, true);
    assert.equal(shapes[head].width, head === "solid-arrow" || head === "triangle" ? 2 : 0);
    assert(shapes[head].extent.every((q) => q.x >= p.x));
  }
  assert.equal(shapes.circle.circle.x - shapes.circle.circle.radius, p.x);
  assert.equal(Math.min(...shapes.diamond.points.map((q) => q.x)), p.x);
});

test("every oblique Straight head moves by d and stays outside rectangle, rounded-corner and ellipse tangent planes", () => {
  const directions = [{ x: 3, y: 1 }, { x: 1.03, y: 1 }, { x: 2, y: 1 }];
  outlines.forEach((outline, i) => {
    const direction = directions[i], length = Math.hypot(direction.x, direction.y), n = { x: direction.x / length, y: direction.y / length };
    const { point: p, normal: N } = outlinePoint(outline, { x: outline.x + outline.width / 2 + direction.x, y: outline.y + outline.height / 2 + direction.y });
    for (const weight of ["thin", "thick"]) for (const kind of HEADS) {
      const raw = connectorHead(kind, p, n, weight), moved = connectorHead(kind, p, n, weight, N);
      const dot = (q) => (q.x - p.x) * N.x + (q.y - p.y) * N.y;
      const minimum = raw.circle ? dot(raw.circle) - raw.circle.radius : Math.min(0, ...raw.points.map(dot));
      const expected = Math.max(0, -minimum) / (n.x * N.x + n.y * N.y);
      near(moved.d, expected); near(moved.inset, raw.inset + expected);
      if (moved.circle) assert(dot(moved.circle) - moved.circle.radius >= -1e-8);
      else assert(moved.points.every((q) => dot(q) >= -1e-8));
    }
  });
});

test("short paths scale two insets proportionally, and Curved shortening remains an exact cubic", () => {
  const short = shortenPath(straightPath({ x: 0, y: 0 }, { x: 10, y: 0 }), 20, 30);
  pointNear(short.samples[0], { x: 4, y: 0 }); pointNear(short.samples.at(-1), { x: 4, y: 0 });
  const original = curvedPath({ x: 0, y: 0 }, { x: 200, y: 100 }, { x: 1, y: 0 }, { x: 0, y: -1 });
  const trimmed = shortenPath(original, 18, 30);
  assert.match(trimmed.path, / C /); assert.doesNotMatch(trimmed.path, / L /); assert.equal(trimmed.segments[0].points.length, 4);
  // Find the original parameters of the new endpoints independently, then
  // compare interior points of the two cubics under that parameter interval.
  const parameter = (p) => {
    let low = 0, high = 1;
    for (let i = 0; i < 60; i++) { const mid = (low + high) / 2; if (curvePoint(original.segments[0].points, mid).x < p.x) low = mid; else high = mid; }
    return (low + high) / 2;
  };
  const a = parameter(trimmed.samples[0]), b = parameter(trimmed.samples.at(-1));
  for (const t of [.1, .3, .5, .8]) pointNear(curvePoint(trimmed.segments[0].points, t), curvePoint(original.segments[0].points, a + (b - a) * t));
  const collapsed = shortenPath(original, 1000, 2000); pointNear(collapsed.samples[0], collapsed.samples.at(-1));
});

test("dash lengths, label midpoints, path/filled-head hits and whole drawn bounds follow the style", () => {
  for (const weight of ["thin", "thick"]) {
    const w = lineWidth({ lineWeight: weight }); assert.equal(w, weight === "thin" ? 3.5 : 7);
    assert.deepEqual(lineDash({ lineWeight: weight, lineDash: "dashed" }), [5 * w, 3 * w]); assert.deepEqual(lineDash({ lineWeight: weight, lineDash: "solid" }), []);
  }
  for (const shape of LINE_SHAPES) {
    const b = joined({ ...defaults, lineShape: shape, lineDash: "dashed", startHead: "diamond", endHead: "circle" }), l = layout(b);
    pointNear(l.labelPoint, halfway(shape === "elbowed" ? l.vertices : l.samples));
    assert(lineHit(l, l.heads[1].circle, 50)); assert(lineHit(l, l.samples[20] ?? l.samples[0], 2));
    assert(connectorInBox(l, l.bounds)); assert(!connectorInBox(l, { ...l.bounds, width: l.bounds.width - .01 }));
  }
  const b = joined({ ...defaults, lineShape: "straight", endHead: "none", lineDash: "dashed" });
  // Horizontal line gives an exact distance independent of interpolation.
  ideas(b)[1].y = ideas(b)[0].y; ideas(b)[1].height = ideas(b)[0].height;
  const l = layout(b), p = halfway(l.samples);
  for (const zoom of [1, 2]) {
    assert(lineHit(l, { x: p.x, y: p.y + 8 / zoom }, zoom)); assert(!lineHit(l, { x: p.x, y: p.y + 8.01 / zoom }, zoom));
  }
  assert(lineHit(l, { x: l.from.x + 6 * l.width, y: l.from.y }, 50)); // a dash gap is still selectable
  for (const endHead of ["solid-arrow", "triangle", "circle", "diamond"]) {
    const filled = layout(changed(b, { endHead })), head = filled.heads[1];
    const centre = head.circle ?? { x: head.points.reduce((sum, q) => sum + q.x, 0) / head.points.length,
      y: head.points.reduce((sum, q) => sum + q.y, 0) / head.points.length };
    assert(lineHit(filled, centre, 50));
  }
  const thick = layout(changed(b, { lineWeight: "thick" }));
  assert(lineHit(thick, { x: p.x, y: p.y + 3.5 }, 20)); assert(!lineHit(thick, { x: p.x, y: p.y + 3.51 }, 20));
});

for (const shape of LINE_SHAPES) test(`${shape} end-drag previews use the pointer rectangle and never alter the board`, () => {
  const b = joined({ ...defaults, lineShape: shape, startHead: "triangle", endHead: "circle" }), before = canonical(b), pointer = { x: 810, y: 330 };
  for (const end of ["from", "to"]) for (const side of ["auto", "top"]) {
    const preview = reconnectPreview(line(b), end, pointer, side, rectangles(b), measure);
    pointNear(preview[end], pointer); assert(preview.path.length > 0);
    if (side !== "auto" && shape !== "straight") assert.equal(preview[end].side, side);
    if (shape === "straight") near(preview.heads[end === "from" ? 0 : 1].d, 0);
  }
  assert.equal(canonical(b), before);
});

test("end press priority, nearest drop edges and tie order, and connection dots winning over rectangles", () => {
  const b = joined(), l = layout(b), a = ideas(b)[0], target = { ...a, displayHeight: a.height };
  assert.equal(pressedEnd(l, l.from, 2), "from"); assert.equal(pressedEnd(l, l.to, 2), "to");
  assert.equal(pressedEnd({ ...l, from: { x: 0, y: 0 }, to: { x: 0, y: 0 } }, { x: 12, y: 0 }, 1), "from");
  assert.equal(pressedEnd({ ...l, from: { x: 0, y: 0 }, to: { x: 0, y: 0 } }, { x: 12.01, y: 0 }, 1), undefined);
  const r = { ...rect(), displayHeight: 100 };
  for (const [point, side] of [[{ x: 1, y: 50 }, "left"], [{ x: 99, y: 50 }, "right"], [{ x: 50, y: 1 }, "top"], [{ x: 50, y: 99 }, "bottom"], [{ x: 50, y: 50 }, "left"], [{ x: 50, y: 0 }, "top"]]) assert.equal(dropSide(r, point), side);
  const objects = [...rectangles(b).values()];
  for (const dot of connectionDots(objects, selection(a), 1)) assert.deepEqual(reconnectTarget(objects, ideas(b)[1].id, dot.point, 1), { target: a.id, side: dot.side });
  const overlap = { ...target, id: "topmost", order: 100 };
  assert.equal(reconnectTarget([...objects, overlap], ideas(b)[1].id, { x: a.x + 30, y: a.y + 30 }, 1).target, "topmost");
  assert.equal(reconnectTarget(objects, a.id, { x: a.x + 10, y: a.y + 10 }, 1), null);
});

test("reconnecting keeps identity, label and style; same target and side returns the same board; invalid ends are refused", () => {
  const b = changed(joined({ ...defaults, lineColor: "red", endHead: "diamond" }), { text: "leads to" }), c = line(b);
  const pinned = reconnect(b, c.id, "from", { ...c.from, anchor: "top" }); assert.notEqual(pinned, b);
  assert.equal(reconnect(pinned, c.id, "from", { ...c.from, anchor: "top" }), pinned);
  const moved = reconnect(pinned, c.id, "from", { object: ideas(b)[2].id, anchor: "left" });
  assert.equal(line(moved).id, c.id); assert.equal(line(moved).generation, c.generation); assert.equal(line(moved).text, c.text);
  assert.deepEqual(connectorStyleOf(line(moved)), connectorStyleOf(c));
  const motion = moveWithMembers(moved, selection(ideas(b)[2]), 300, -400); assert.equal(layout(motion).from.side, "left");
  const section = add(b, "section", 0, 0).objects.at(-1), stroke = makeStroke(b, [{ x: 5, y: 5 }, { x: 6, y: 6 }], { kind: "marker", color: "black", weight: "thin" }, true);
  const full = placeObject(placeObject(b, section), stroke);
  for (const target of [c.to.object, c.id, section.id, stroke.id, crypto.randomUUID()]) assert.equal(reconnect(full, c.id, "from", { object: target, anchor: "top" }), full);
  assert.equal(reconnect(b, c.id, "to", { ...c.to, anchor: "invalid" }), b);
});

test("style changes update every selected connector in one step, preserve other records and refuse mixed selections", () => {
  const b = joined(), next = createConnector(b, ideas(b)[1].id, ideas(b)[2].id).board, connectors = next.objects.filter(hasEnds), selected = selection(...connectors);
  const styled = changeConnectorStyle(next, selected, "endHead", "triangle");
  assert(styled.objects.filter(hasEnds).every((c) => c.endHead === "triangle"));
  assert.deepEqual(ideas(styled), ideas(next)); assert.equal(record(emptyHistory(), next, styled).past.length, 1);
  assert.equal(changeConnectorStyle(styled, selected, "endHead", "triangle"), styled);
  assert.equal(changeConnectorStyle(next, selection(connectors[0], ideas(next)[0]), "lineWeight", "thick"), next);
  assert.equal(changeConnectorStyle(next, new Set(), "lineColor", "red"), next);
  assert.equal(changeConnectorStyle(next, selected, "lineColor", "#ABCDEF"), next);
});

test("Duplicate and Paste preserve style and anchors while remapping both ends; creating takes the supplied style and auto anchors", () => {
  const style = { ...defaults, lineColor: "blue", lineWeight: "thick", lineDash: "dashed", startHead: "circle", endHead: "diamond", lineShape: "curved" };
  const b = joined(style), c = line(b); c.from.anchor = "top"; c.to.anchor = "right"; c.text = "copies";
  const selected = selection(...ideas(b).slice(0, 2));
  const drawn = b.objects.map((o) => hasEnds(o) ? { ...o, ...layout(b).bounds, displayHeight: layout(b).bounds.height } : { ...o, displayHeight: o.height });
  const snapshot = buildSnapshot(b, selected, drawn), paste = buildPaste(b, snapshot, { centerX: 0, centerY: 0, zoom: 1, width: 1280, height: 800 });
  const copy = duplicate(b, emptyHistory(), ideas(b).slice(0, 2));
  for (const result of [paste, copy]) {
    const copies = result.board.objects.filter((o) => !b.objects.some((old) => old.id === o.id)), connector = copies.find(hasEnds);
    assert.deepEqual(connectorStyleOf(connector), style); assert.equal(connector.from.anchor, "top"); assert.equal(connector.to.anchor, "right");
    assert.notEqual(connector.from.object, c.from.object); assert.notEqual(connector.to.object, c.to.object);
    assert(copies.some((o) => o.id === connector.from.object)); assert(copies.some((o) => o.id === connector.to.object)); validate(result.board);
  }
  const created = line(joined(style)); assert.deepEqual(connectorStyleOf(created), style);
  assert.equal(created.from.anchor, "auto"); assert.equal(created.to.anchor, "auto");
});

// Hook and screen-part checks use the server renderer with synthetic surfaces.
// They do not launch a browser or claim browser focus/capture/blur evidence.
const { build } = await import("../apps/web/node_modules/esbuild/lib/main.js");
const reactURL = new URL("../apps/web/node_modules/react/index.js", import.meta.url);
const { createElement } = await import(reactURL.href);
const { renderToStaticMarkup } = await import("../apps/web/node_modules/react-dom/server.node.js");
const compiled = await build({ stdin: { contents: `
  export { useBoardDocument } from "./state/use-board-document.ts";
  export { useEditingCommands } from "./state/use-editing-commands.ts";
  export { useCanvasInput } from "./state/use-canvas-input.ts";
  export { ConnectorControls } from "./ui/connector-controls.tsx";
  export { ConnectorFields } from "./ui/connector-fields.tsx";
`, resolveDir: new URL("../apps/web/src/", import.meta.url).pathname, loader: "ts" }, bundle: true, write: false, platform: "node", format: "esm",
  plugins: [{ name: "shared-react", setup(build) {
    build.onResolve({ filter: /^(react(?:\/.*)?|yjs)$/ }, (args) => ({ path: args.path === "react" ? reactURL.href :
      new URL(args.path === "yjs" ? "../apps/web/node_modules/yjs/dist/yjs.mjs" : "../apps/web/node_modules/" + args.path + ".js", import.meta.url).href, external: true }));
  } }] });
const hooks = await import("data:text/javascript;base64," + Buffer.from(compiled.outputFiles[0].text).toString("base64"));
const renderHook = (fn) => { let value; renderToStaticMarkup(createElement(function Harness() { value = fn(); return null; })); return value; };
function harness(b, selected = selection(line(b)), options = {}) {
  const statuses = [];
  const doc = renderHook(() => hooks.useBoardDocument({ readOnly: false, setStatus(value) { statuses.push(value); } }));
  doc.load(b);
  const captures = new Set(), events = { selected, message: "", busy: false, focus: "", status: "", updates: 0 };
  const surface = { getBoundingClientRect: () => ({ left: 0, top: 0, right: 1280, bottom: 800 }),
    focus() { events.focus = "scene"; }, setPointerCapture(id) { captures.add(id); }, hasPointerCapture: (id) => captures.has(id), releasePointerCapture(id) { captures.delete(id); } };
  const drag = { current: null }, state = { readOnly: false, composing: false, pointerGesture: false, invalidObjectText: false };
  const h = { doc, events, statuses, surface, drag, captures, canvas: null, commands: null, refresh };
  function refresh() {
    const b = doc.model.current, boxes = rectangles(b), objects = b.objects.map((o) => {
      const l = hasEnds(o) ? connectorLayout(o, boxes, measure) : undefined;
      return { ...o, ...l?.bounds, displayHeight: l?.bounds.height ?? o.height, connectorLayout: l };
    });
    const common = { ...doc, tool: "Select", scene: { current: surface }, selected: events.selected,
      select: (value) => { events.selected = new Set(typeof value === "string" ? [value] : value); }, setMessage: (value) => { events.message = value; },
      setInline() {}, setPanel() {}, setTool() {}, view: { x: 0, y: 0, z: 1 }, setView() {}, displayedObjects: objects,
      readOnly: false, composing: false, busy: false, lineCount: () => 1, editor: { current: null }, selector: { current: { focus() {} } },
      commandReason: "", selectionReason: "", clipboardState: state, editingState: state,
      arrangementMembers: objects.filter((o) => events.selected.has(o.id)), messageSequence: { current: 0 }, alive: { current: true }, growAvailable: false, growHeight: 0, ...options };
    h.commands = renderHook(() => hooks.useEditingCommands(common));
    h.canvas = renderHook(() => hooks.useCanvasInput({ ...common, clearHistory() {}, drag, size: { w: 1280, h: 800 },
      trackPointer() {}, setBusy(value) { events.busy = value; }, spacePanRef: { current: false }, setSpacePan() {}, setSelectionBox() {},
      setBoard() { events.updates++; }, textEditing: false, inline: false, invalidObjectText: false, handlesVisible: false, handlePoints: [],
      objectLayouts: new Map(objects.map((o) => [o.id, { height: o.displayHeight }])), edit() {}, ...options }));
  }
  refresh(); return h;
}
const pointer = (h, p, extra = {}) => ({ target: h.surface, currentTarget: h.surface, clientX: p.x + 640, clientY: p.y + 400,
  button: 0, pointerId: 1, isPrimary: true, preventDefault() {}, ...extra });

test("actual remembered-style choices include no-op choices and survive Undo, Redo and reconnect, then reset on load", () => {
  const b = joined({ ...defaults, endHead: "circle" }), h = harness(b), c = line(b);
  h.commands.connectorCommands.style("endHead", "circle");
  assert.equal(h.doc.historyRef.current.past.length, 0); assert.equal(h.doc.revision.current, 0);
  assert.equal(h.doc.connectorStyle.current.endHead, "circle");
  h.commands.connectorCommands.style("lineWeight", "thick");
  assert.equal(h.doc.historyRef.current.past.length, 1); assert.equal(h.doc.revision.current, 1);
  h.commands.command("Undo"); assert.equal(line(h.doc.model.current).lineWeight, "thin"); assert.equal(h.doc.connectorStyle.current.lineWeight, "thick");
  h.commands.command("Redo"); assert.equal(h.doc.connectorStyle.current.endHead, "circle");
  h.commands.connectorCommands.reconnect(c.id, "from", { object: c.from.object, anchor: "top" });
  assert.deepEqual(h.doc.connectorStyle.current, { ...defaults, lineWeight: "thick", endHead: "circle" });
  h.events.selected = selection(...ideas(h.doc.model.current).slice(0, 2)); h.refresh();
  h.commands.arrange("Connect");
  const created = h.doc.model.current.objects.filter(hasEnds).at(-1);
  assert.deepEqual(connectorStyleOf(created), h.doc.connectorStyle.current); assert.equal(created.from.anchor, "auto"); assert.equal(created.to.anchor, "auto");
  // The dot-drag route consumes the same remembered style.
  h.events.selected = selection(ideas(h.doc.model.current)[0]); h.refresh();
  const dot = h.canvas.dots.find((d) => d.side === "right"), target = ideas(h.doc.model.current)[2];
  h.canvas.pointerDown(pointer(h, dot.point)); h.canvas.pointerUp(pointer(h, { x: target.x + 10, y: target.y + 10 }));
  const dotted = h.doc.model.current.objects.filter(hasEnds).at(-1);
  assert.deepEqual(connectorStyleOf(dotted), h.doc.connectorStyle.current); assert.equal(dotted.from.anchor, "auto"); assert.equal(dotted.to.anchor, "auto");
  h.doc.load(validate(JSON.parse(canonical(h.doc.model.current))));
  assert.deepEqual(h.doc.connectorStyle.current, defaults); assert.equal(h.doc.revision.current, 0); assert.equal(h.doc.historyRef.current.past.length, 0);
  h.doc.adapter.current.destroy();
});

test("actual mixed style change is one transaction for all connectors and sets only the remembered value chosen", () => {
  const b = joined(), both = createConnector(b, ideas(b)[1].id, ideas(b)[2].id, { ...defaults, lineColor: "red", endHead: "diamond" }).board;
  const h = harness(both, selection(...both.objects.filter(hasEnds)));
  h.commands.connectorCommands.style("lineColor", "blue");
  assert.equal(h.doc.historyRef.current.past.length, 1); assert.equal(h.doc.revision.current, 1);
  assert(h.doc.model.current.objects.filter(hasEnds).every((o) => o.lineColor === "blue"));
  assert.deepEqual(h.doc.connectorStyle.current, { ...defaults, lineColor: "blue" });
  h.commands.command("Undo"); assert.equal(canonical(h.doc.model.current), canonical(both));
  assert.equal(h.doc.connectorStyle.current.lineColor, "blue"); h.doc.adapter.current.destroy();
});

for (const end of ["from", "to"]) test(`actual ${end} drag captures ahead of the idea underneath and commits one pinned reconnect`, () => {
  const b = changed(joined({ ...defaults, lineShape: "curved", startHead: "diamond" }), { text: "relationship" }), c = line(b), h = harness(b), target = ideas(b)[2];
  h.canvas.pointerDown(pointer(h, layout(b)[end])); assert(h.drag.current.connection.reconnect); assert(h.captures.has(1));
  const p = { x: target.x + 1, y: target.y + target.height / 2 };
  h.canvas.pointerMove(pointer(h, p)); assert.equal(h.drag.current.connection.target, target.id); assert.equal(h.drag.current.connection.side, "left");
  assert.equal(canonical(h.doc.model.current), canonical(b));
  h.canvas.pointerUp(pointer(h, p));
  assert.equal(h.captures.size, 0); assert.equal(h.drag.current, null); assert.equal(h.events.busy, false);
  assert.equal(h.doc.historyRef.current.past.length, 1); assert.equal(h.doc.revision.current, 1);
  assert.deepEqual(line(h.doc.model.current)[end], { object: target.id, anchor: "left" });
  assert.equal(line(h.doc.model.current).id, c.id); assert.equal(line(h.doc.model.current).text, c.text);
  assert.deepEqual(connectorStyleOf(line(h.doc.model.current)), connectorStyleOf(c)); assert.deepEqual(h.events.selected, selection(c));
  h.commands.command("Undo"); assert.equal(canonical(h.doc.model.current), canonical(b)); h.doc.adapter.current.destroy();
});

test("actual own-idea drops change only a different side, repeated drops make no step, and target dots set their side", () => {
  const b = joined(), h = harness(b), c = line(b), own = ideas(b)[0];
  const p = { x: own.x + own.width / 2, y: own.y + 1 };
  h.canvas.pointerDown(pointer(h, layout(b).from)); h.canvas.pointerUp(pointer(h, p));
  assert.equal(line(h.doc.model.current).from.anchor, "top"); assert.equal(h.doc.historyRef.current.past.length, 1);
  h.refresh(); h.canvas.pointerDown(pointer(h, layout(h.doc.model.current).from)); h.canvas.pointerUp(pointer(h, p));
  assert.equal(h.doc.historyRef.current.past.length, 1); assert.equal(h.doc.revision.current, 1);
  assert.deepEqual(h.statuses, ["Unsaved"]);
  const target = ideas(b)[2], dots = connectionDots([...rectangles(b).values()], selection(target), 1), dot = dots.find((d) => d.side === "top");
  h.refresh(); h.canvas.pointerDown(pointer(h, layout(h.doc.model.current).from)); h.canvas.pointerUp(pointer(h, dot.point));
  assert.deepEqual(line(h.doc.model.current).from, { object: target.id, anchor: "top" }); assert.equal(h.events.message, ""); h.doc.adapter.current.destroy();
});

for (const end of ["from", "to"]) test(`actual auto ${end} end drops keep the same drawn side unchanged and pin another side`, () => {
  const b = joined(), c = line(b), h = harness(b), start = layout(b)[end], before = h.doc.model.current;
  const own = ideas(b).find((o) => o.id === c[end].object);
  h.canvas.pointerDown(pointer(h, start)); h.canvas.pointerUp(pointer(h, start));
  assert.equal(h.doc.model.current, before); assert.equal(line(h.doc.model.current)[end].anchor, "auto");
  assert.equal(h.doc.revision.current, 0); assert.equal(h.doc.historyRef.current.past.length, 0);
  assert.deepEqual(h.statuses, []); assert.equal(h.captures.size, 0);
  // Returning to the same side after moving is also a no-op.
  h.refresh(); h.canvas.pointerDown(pointer(h, start));
  h.canvas.pointerMove(pointer(h, { x: 700, y: 300 })); h.canvas.pointerUp(pointer(h, start));
  assert.equal(h.doc.model.current, before); assert.deepEqual(h.statuses, []);
  assert.equal(h.doc.revision.current, 0); assert.equal(h.doc.historyRef.current.past.length, 0);
  const side = start.side === "top" ? "bottom" : "top";
  const p = { x: own.x + own.width / 2, y: side === "top" ? own.y + 1 : own.y + own.height - 1 };
  h.refresh(); h.canvas.pointerDown(pointer(h, start)); h.canvas.pointerUp(pointer(h, p));
  assert.deepEqual(line(h.doc.model.current)[end], { object: own.id, anchor: side });
  assert.equal(h.doc.revision.current, 1); assert.equal(h.doc.historyRef.current.past.length, 1);
  assert.deepEqual(h.statuses, ["Unsaved"]); h.doc.adapter.current.destroy();
});

test("loading a version 8 board with connectors upgrades without a revision, history step or Unsaved status", () => {
  const old = oldVersion(joined(), 8), bytes = canonical(old), statuses = [];
  const doc = renderHook(() => hooks.useBoardDocument({ readOnly: false, setStatus(value) { statuses.push(value); } }));
  doc.load(validate(JSON.parse(bytes)));
  assert.equal(doc.model.current.schemaVersion, 10); assert.equal(doc.revision.current, 0);
  assert.deepEqual(doc.historyRef.current, emptyHistory()); assert.deepEqual(statuses, []);
  assert.deepEqual(connectorStyleOf(line(doc.model.current)), defaults);
  assert.equal(line(doc.model.current).from.anchor, "auto"); assert.equal(line(doc.model.current).to.anchor, "auto");
  assert.equal(canonical(old), bytes); doc.adapter.current.destroy();
});

for (const finish of ["empty", "other", "outside", "cancel", "lost", "escape"]) test(`actual reconnect ${finish} restores the end with no change, history or notice`, () => {
  const b = joined(), h = harness(b), c = line(b), before = canonical(b), other = ideas(b)[1];
  h.canvas.pointerDown(pointer(h, layout(b).from));
  const p = finish === "other" ? { x: other.x + 20, y: other.y + 20 } : { x: 900, y: 600 };
  h.canvas.pointerMove(pointer(h, p));
  if (finish === "cancel") h.canvas.pointerCancel();
  else if (finish === "lost") h.canvas.lostPointerCapture();
  else if (finish === "escape") h.canvas.cancel(); // page's Escape route delegates to cancel
  else h.canvas.pointerUp(pointer(h, p));
  assert.equal(canonical(h.doc.model.current), before); assert.equal(h.doc.revision.current, 0); assert.equal(h.doc.historyRef.current.past.length, 0);
  assert.deepEqual(h.events.selected, selection(c)); assert.equal(h.events.message, ""); assert.equal(h.drag.current, null); assert.equal(h.captures.size, 0);
  h.doc.adapter.current.destroy();
});

for (const options of [{ readOnly: true }, { composing: true }, { inline: true }, { busy: true }, { textEditing: true }, { tool: "Pan" }]) test(`actual reconnect refuses ${JSON.stringify(options)}`, () => {
  const b = joined(), h = harness(b, selection(line(b)), options);
  h.canvas.pointerDown(pointer(h, layout(b).from)); assert(!h.drag.current?.connection?.reconnect); h.doc.adapter.current.destroy();
});

test("connector toolbar has the contracted order, mixed values and radio choices; Ends has reading-order labels and direct keys", () => {
  const b = joined(), c = line(b), controls = { colour: {}, line: {}, start: {}, route: {}, end: {} }, commands = { style() {}, reconnect() {} };
  const popup = { open: "", controls, buttons: controls, menu: {} };
  const props = { objects: [c], count: 1, empty: true, commands, reason: "", popup, edit() {}, remove() {} };
  const markup = renderToStaticMarkup(createElement(hooks.ConnectorControls, props));
  const labels = [">Connector<", 'aria-label="Colour: Dark gray"', 'aria-label="Line style: Thin, Solid"', ">Add text<", 'aria-label="Start point: None"', 'aria-label="Line shape: Elbowed"', 'aria-label="End point: Line arrow"', 'aria-label="Delete"'];
  const positions = labels.map((label) => markup.indexOf(label)); assert(positions.every((p, i) => p >= 0 && (!i || p > positions[i - 1])));
  for (const name of ["colour", "line", "start", "route", "end"]) {
    const html = renderToStaticMarkup(createElement(hooks.ConnectorControls, { ...props, popup: { ...popup, open: name } }));
    assert.match(html, new RegExp('id="connector-' + name + '-popup"'));
    if (name === "start" || name === "end") assert.equal((html.match(/role="menuitemradio"/g) ?? []).length, 6);
    if (name === "route") assert.equal((html.match(/role="menuitemradio"/g) ?? []).length, 3);
  }
  const mixed = renderToStaticMarkup(createElement(hooks.ConnectorControls, { ...props, count: 2,
    objects: [c, { ...c, lineColor: "red", lineWeight: "thick", lineDash: "dashed", startHead: "circle", endHead: "diamond", lineShape: "straight" }], popup: { ...popup, open: "end" } }));
  for (const name of ["Colour", "Start point", "End point", "Line shape"]) assert(mixed.includes('aria-label="' + name + ': Mixed"'));
  assert.doesNotMatch(mixed, /aria-checked="true"|aria-pressed="true"/); assert.doesNotMatch(mixed, />Add text</);
  const fields = hooks.ConnectorFields({ board: b, object: c, numbers: new Map(), drafts: {}, commands, reason: "" });
  const html = renderToStaticMarkup(fields); assert.match(html, /<legend>Ends<\/legend>/);
  const rows = fields.props.children[1], from = rows[0], select = from.props.children[1];
  assert.deepEqual(select.props.children.map((option) => option.props.value), ideas(b).filter((o) => o.id !== c.to.object).map((o) => o.id));
  assert.deepEqual(select.props.children.map((option) => option.props.children), ideas(b).filter((o) => o.id !== c.to.object).map((o) => objectLabel(b, o, new Map(), {})));
  const calls = [], keyFields = hooks.ConnectorFields({ board: b, object: c, numbers: new Map(), drafts: {}, commands: { ...commands, reconnect: (...args) => calls.push(args) }, reason: "" });
  const sideSelect = keyFields.props.children[1][0].props.children[3];
  for (const [key, expected] of [["ArrowDown", "top"], ["Home", "auto"], ["End", "left"], ["ArrowUp", "auto"]]) {
    sideSelect.props.onKeyDown({ key, currentTarget: { selectedIndex: 0, options: END_SIDES.map((value) => ({ value })) }, preventDefault() {}, stopPropagation() {} });
    assert.deepEqual(calls.at(-1), [c.id, "from", { ...c.from, anchor: expected }]);
  }
});


test("a version 7 activity adds default-styled auto-anchor connectors onto a version 9 board", async () => {
  const { insertActivity } = await import("../apps/web/src/activities.ts");
  const activity = oldVersion(joined(), 7), board = { ...empty(), title: "Synthetic template destination" };
  const result = insertActivity(board, activity, { x: 0, y: 0, z: 1 }, { w: 1280, h: 800 });
  assert.equal(result.board.schemaVersion, 10); validate(result.board);
  assert.deepEqual(connectorStyleOf(line(result.board)), defaults); assert.equal(line(result.board).from.anchor, "auto");
  assert.equal(activity.schemaVersion, 7); assert(!("lineColor" in line(activity)));
});
