// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import * as Y from "yjs";
import { Adapter } from "../packages/board-sync/src/document-adapter.ts";
import { readBoard } from "../packages/board-sync/src/codec.ts";
import { BoardSession, encode, decode } from "../packages/board-sync/src/session.ts";
import { capture, SharedUndo } from "../packages/board-sync/src/undo.ts";
import { promote } from "../packages/board-room/src/conflicts.ts";
import { evaluate } from "../packages/board-room/src/edits.ts";
import { initialize } from "../packages/board-room/src/storage.ts";
import { NodeStorage } from "../apps/server/src/node-storage.ts";
import { add, empty, canonical, upgrade, validate } from "../packages/board-rules/src/document.ts";
import { OBJECT_TYPES } from "../packages/board-rules/src/objects/registry.ts";
import { defaultConnectorStyle } from "../packages/board-rules/src/objects/connector.ts";
const board = () => add({ ...upgrade(empty()), title: "Shared" }, "sticky", 0, 0);
const clone = (value) => JSON.parse(JSON.stringify(value));
function adapter(value, id) {
  const a = new Adapter(); if (id !== undefined) a.doc.clientID = id;
  if (value instanceof Uint8Array) Y.applyUpdate(a.doc, value); else a.set(value);
  return a;
}
function update(a, change) {
  const vector = Y.encodeStateVector(a.doc); a.set(change(readBoard(a.doc)));
  return Y.encodeStateAsUpdate(a.doc, vector);
}
const object = (b, patch, index = 0) => ({ ...b, objects: b.objects.map((o, i) => i === index ? { ...o, ...patch } : o) });
function deleted(b, ids) {
  const removed = new Set(ids);
  return { ...b, objects: b.objects.filter((o) => !removed.has(o.id)).map((o, order) => ({ ...o,
    section: removed.has(o.section) ? null : o.section, order })),
  retiredGenerations: [...b.retiredGenerations, ...b.objects.filter((o) => removed.has(o.id)).map((o) => o.generation)].sort() };
}
function connector(b, from, to) {
  return { ...b, objects: [...b.objects, { id: crypto.randomUUID(), generation: crypto.randomUUID(), type: "connector",
    order: b.objects.length, group: null, section: null, text: "", marks: [], color: "neutral", textSize: "medium", align: "center", ...defaultConnectorStyle(),
    from: { object: from, anchor: "auto" }, to: { object: to, anchor: "auto" } }] };
}
function converge(initial, edits, ids = [10, 20], reverse = false) {
  const seed = adapter(initial), bytes = Y.encodeStateAsUpdate(seed.doc);
  const a = adapter(bytes, ids[0]), b = adapter(bytes, ids[1]);
  const storage = new NodeStorage(":memory:"); initialize(storage);
  let doc = seed.doc, current = readBoard(doc); const results = [];
  try {
    const updates = [update(a, edits[0]), update(b, edits[1])];
    for (const i of reverse ? [1, 0] : [0, 1]) {
      const result = evaluate(doc, current, updates[i], storage);
      assert.equal(result.kind, "complete", result.reason);
      results.push(result);
      doc = result.doc; current = result.board;
      for (const o of result.identifiers) storage.exec("INSERT OR IGNORE INTO identifiers VALUES (?, ?, 1)", o.id, o.generation);
      Y.applyUpdate(a.doc, result.update); Y.applyUpdate(b.doc, result.update);
    }
    assert.equal(canonical(readBoard(a.doc)), canonical(current)); assert.equal(canonical(readBoard(b.doc)), canonical(current));
    return { board: clone(current), results: results.map((r) => ({ changed: r.changed, identifiers: r.identifiers })) };
  } finally { seed.destroy(); a.destroy(); b.destroy(); for (const r of results) r.doc.destroy(); storage.close(); }
}

for (const [old, next] of [["abcd", "Xabcd"], ["abcd", "abXcd"], ["abcd", "abcdX"], ["abcd", "bcd"], ["abcd", "acd"],
  ["abcd", "abc"], ["abcd", "Xbcd"], ["abcd", "abXd"], ["abcd", "abcX"], ["aaa", "aa"],
  ["a😀b", "a🚀b"], ["ae\u0301b", "aéb"], ["a👩‍👩‍👧‍👦b", "a👨‍👩‍👧b"]]) test(`grapheme write ${JSON.stringify(old)} → ${JSON.stringify(next)}`, () => {
  const initial = object(board(), { text: old }), a = adapter(initial);
  const seen = []; a.doc.getMap("objects").get(initial.objects[0].id).get("text").observe((event) => seen.push(event.delta));
  update(a, (b) => object(b, { text: next })); assert.equal(readBoard(a.doc).objects[0].text, next);
  if (old === "aaa") assert.deepEqual(seen[0], [{ retain: 2 }, { delete: 1 }]);
  if (old === "a😀b") assert.deepEqual(seen[0], [{ retain: 1 }, { delete: 2 }, { insert: "🚀" }]);
  if (old === "ae\u0301b") assert.deepEqual(seen[0], [{ retain: 1 }, { delete: 2 }, { insert: "é" }]);
  if (old.includes("👩")) assert.deepEqual(seen[0], [{ retain: 1 }, { delete: "👩‍👩‍👧‍👦".length }, { insert: "👨‍👩‍👧" }]);
  let writes = 0; a.doc.on("update", () => writes++); a.set(readBoard(a.doc)); assert.equal(writes, 0); a.destroy();
});

test("adapter roundtrip preserves every base object type", () => {
  let b = { ...upgrade(empty()), title: "Shared" };
  for (const type of OBJECT_TYPES.filter((t) => t.type !== "connector" && t.type !== "image" && t.type !== "stroke")) b = add(b, type.type, 0, 0);
  b = connector(b, b.objects.find((o) => o.type === "sticky").id, b.objects.find((o) => o.type === "text").id);
  // Base fixtures contain valid image and stroke objects too.
  const image = { id: crypto.randomUUID(), generation: crypto.randomUUID(), type: "image", asset: "a".repeat(64), pixelWidth: 1,
    pixelHeight: 1, description: "Synthetic", x: 0, y: 0, width: 100, height: 100, group: null, section: null, order: b.objects.length };
  b.objects.push(image);
  b.objects.push({ id: crypto.randomUUID(), generation: crypto.randomUUID(), type: "stroke", order: b.objects.length,
    group: null, section: null, x: 0, y: 0, width: 24, height: 24, kind: "marker", color: "black", weight: "thin", points: [[2, 2], [22, 22]] });
  const a = adapter(b); assert.equal(canonical(readBoard(a.doc)), canonical(b)); a.destroy();
});

for (const reverse of [false, true]) test(`concurrent grapheme edits and repeated prefix converge, reverse=${reverse}`, () => {
  for (const [old, left, right, expected] of [["abcd", "Xabcd", "abcdY", "XabcdY"], ["abcd", "abXcd", "abcYd", "abXcYd"],
    ["a😀b", "a😀Xb", "a😀b🚀", "a😀Xb🚀"], ["e\u0301x", "Ae\u0301x", "e\u0301xB", "Ae\u0301xB"], ["aaa", "aa", "Xaaa", "Xaa"]]) {
    assert.equal(converge(object(board(), { text: old }), [(b) => object(b, { text: left }), (b) => object(b, { text: right })], [10, 20], reverse).board.objects[0].text, expected);
  }
  const b = object(board(), { text: "abcd" });
  const result = converge(b, [(b) => object(b, { text: "abXcd" }), (b) => object(b, { text: "abYcd" })], [10, 20], reverse);
  assert.equal(result.board.objects[0].text, "abXYcd");
});

const units = [
  ["geometry", (b) => object(b, { x: 10 }), (b) => object(b, { width: 200 }), (o) => [o.x, o.width]],
  ["style", (b) => object(b, { color: "yellow" }), (b) => object(b, { textSize: "large" }), (o) => [o.color, o.textSize]],
  ["marks", (b) => object(b, { marks: [{ start: 0, end: 1, bold: true }] }), (b) => object(b, { marks: [{ start: 1, end: 2, italic: true }] }), (o) => o.marks],
  ["order", (b) => ({ ...b, objects: [...b.objects].reverse().map((o, order) => ({ ...o, order })) }), (b) => b, (o) => o.order],
  ["group", (b) => object(b, { group: "11111111-1111-4111-8111-111111111111" }), (b) => object(b, { group: "22222222-2222-4222-8222-222222222222" }), (o) => o.group],
];
for (const ids of [[10, 20], [20, 10]]) for (const reverse of [false, true]) test(`last saved units win ids=${ids} reverse=${reverse}`, () => {
  for (const [name, left, right, read] of units.filter(([name]) => name !== "order")) {
    const b = object(board(), { text: "abcdef" });
    const result = converge(b, [left, right], ids, reverse).board;
    assert.deepEqual(read(result.objects[0]), read((reverse ? left : right)(b).objects[0]), name);
  }
  const b = board();
  assert.equal(converge(b, [(b) => ({ ...b, title: "Left" }), (b) => ({ ...b, title: "Right" })], ids, reverse).board.title, reverse ? "Left" : "Right");
  const shape = add(b, "shape", 0, 0);
  assert.deepEqual(converge(shape, [(b) => object(b, { fill: { mode: "fill", color: "red" } }, 1),
    (b) => object(b, { fill: { mode: "fill", color: "blue" } }, 1)], ids, reverse).board.objects[1].fill,
  { mode: "fill", color: reverse ? "red" : "blue" });
});

for (const reverse of [false, true]) test(`repair collisions, marks and dangling topology reverse=${reverse}`, () => {
  const b = object(board(), { text: "abcdef" });
  const adds = converge(b, [(b) => add(b, "sticky", 10, 10), (b) => add(b, "sticky", 20, 20)], [10, 20], reverse);
  assert.equal(adds.board.objects.length, 3); assert.equal(adds.results[1].changed, true);
  const marks = converge(b, [(b) => object(b, { text: "ab" }), (b) => object(b, { marks: [{ start: 3, end: 5, bold: true }] })], [10, 20], reverse);
  assert.deepEqual(marks.board.objects[0].marks, []); assert(marks.results[1].changed);
  const two = add(b, "sticky", 100, 100), n = two.objects[0].id, m = two.objects[1].id;
  const dangling = converge(two, [(b) => deleted(b, [n]), (b) => connector(b, n, m)], [10, 20], reverse);
  assert.equal(dangling.board.objects.length, 1); assert(dangling.results[1].changed);
  const withSection = add(b, "section", 0, 0), section = withSection.objects[1].id;
  assert.equal(converge(withSection, [(b) => deleted(b, [section]), (b) => object(b, { section })], [10, 20], reverse).board.objects[0].section, null);
  assert.equal(converge(two, [(b) => object(b, { x: 1 }), (b) => object(b, { text: "other" }, 1)], [10, 20], reverse).results.some((r) => r.changed), false);
});

function historyFixture(initial = board()) {
  const a = adapter(initial), history = new SharedUndo();
  const own = (change) => { const before = capture(a.doc); a.set(change(readBoard(a.doc))); history.record(before, capture(a.doc)); };
  const remote = (change, equalAssignment = false) => {
    const before = capture(a.doc), other = adapter(Y.encodeStateAsUpdate(a.doc));
    other.set(change(readBoard(other.doc)));
    if (equalAssignment) other.doc.getMap("objects").get(initial.objects[0].id).set("geometry", other.doc.getMap("objects").get(initial.objects[0].id).get("geometry"));
    Y.applyUpdate(a.doc, Y.encodeStateAsUpdate(other.doc)); history.observe(before, capture(a.doc), false); other.destroy();
  };
  const take = (direction = "undo") => { const before = capture(a.doc), result = history.take(before, direction);
    if (typeof result === "string") return result; a.set(result); history.record(before, capture(a.doc), direction); return readBoard(a.doc); };
  return { a, history, own, remote, take, board: () => readBoard(a.doc) };
}

test("undo keeps remote text, skips remote geometry, redoes only changed units", () => {
  const f = historyFixture();
  f.own((b) => object(b, { x: 10, color: "yellow" })); f.remote((b) => object(b, { x: 20, text: "other" }));
  assert.equal(f.take().objects[0].x, 20); assert.equal(f.board().objects[0].text, "other");
  assert.equal(f.take("redo").objects[0].color, "yellow"); assert.equal(f.board().objects[0].x, 20); f.a.destroy();
});

test("own guard follows two moves and equal-valued room promotion", () => {
  const f = historyFixture(); const initial = f.board().objects[0].x;
  f.own((b) => object(b, { x: 10 })); f.own((b) => object(b, { x: 20 }));
  assert.equal(f.take().objects[0].x, 10);
  const before = capture(f.a.doc), map = f.a.doc.getMap("objects").get(f.board().objects[0].id);
  map.set("geometry", map.get("geometry")); f.history.observe(before, capture(f.a.doc), true);
  assert.equal(f.take().objects[0].x, initial); f.a.destroy();
});

test("equal-valued remote assignment kills guards permanently", () => {
  const f = historyFixture();
  f.own((b) => object(b, { x: 10 })); f.remote((b) => b, true);
  f.own((b) => object(b, { x: 20 })); assert.equal(f.take().objects[0].x, 10);
  assert.equal(f.take(), "changed_by_others"); assert.equal(f.board().objects[0].x, 10); f.a.destroy();
});

test("undo add is guarded against remote edits, and redo add creates fresh identities", () => {
  const f = historyFixture(); f.own((b) => add(b, "sticky", 10, 10)); const added = f.board().objects[1];
  f.remote((b) => object(b, { text: "other" }, 1)); assert.equal(f.take(), "changed_by_others"); f.a.destroy();
  const g = historyFixture(); g.own((b) => add(b, "sticky", 10, 10)); const old = g.board().objects[1];
  assert.equal(g.take().objects.length, 1); const restored = g.take("redo").objects[1];
  assert.notEqual(restored.id, old.id); assert.notEqual(restored.generation, old.generation); assert.notEqual(added.id, restored.id); g.a.destroy();
});

test("delete undo restores connector topology with new IDs and redo preserves remote edits", () => {
  let b = add(board(), "sticky", 100, 100); b = connector(b, b.objects[0].id, b.objects[1].id);
  const f = historyFixture(b), old = b.objects[0], link = b.objects[2];
  f.own((b) => deleted(b, [old.id, link.id])); f.remote((b) => object(b, { text: "kept" }));
  const before = f.board(), undone = f.take(); assert.equal(undone.objects.length, 3);
  const n = undone.objects.find((o) => o.id !== b.objects[1].id && o.type === "sticky"), k = undone.objects.find((o) => o.type === "connector");
  assert.notEqual(n.id, old.id); assert.notEqual(n.generation, old.generation); assert.equal(k.from.object, n.id);
  assert.deepEqual(f.take("redo").objects, before.objects); assert.notEqual(f.take().objects.find((o) => o.type === "connector").id, k.id); f.a.destroy();
});

test("undo invalid is dropped, history caps at 100, connections are independent", () => {
  const f = historyFixture();
  for (let i = 1; i <= 101; i++) f.own((b) => object(b, { x: i }));
  assert.equal(f.history.past.length, 100); const other = new SharedUndo(); assert.equal(other.take(capture(f.a.doc), "undo"), "nothing_to_undo");
  f.history.past.at(-1)[0].before = { x: Infinity, y: 0, width: 100, height: 100 };
  assert.equal(f.take(), "undo_invalid"); assert.equal(f.history.past.length, 99); f.a.destroy();
});

function fakeClock() {
  let now = 0; const tasks = new Set();
  return { now: () => now, after(ms, run) { const task = { at: now + ms, run }; tasks.add(task); return () => tasks.delete(task); },
    advance(ms) { const until = now + ms; for (;;) { const next = [...tasks].filter((t) => t.at <= until).sort((a, b) => a.at - b.at)[0];
      if (!next) break; now = next.at; tasks.delete(next); next.run(); } now = until; } };
}
async function fakeSession(role = "editor") {
  const seed = adapter(board()), clock = fakeClock(), wires = []; let tickets = 0;
  const joined = { kind: "joined", epoch: 0, role, revision: 0, update: encode(Y.encodeStateAsUpdate(seed.doc)), self: {}, present: [] };
  const client = await BoardSession.join({ clock, clientId: 123, ticket: async () => ++tickets,
    open: async () => { const wire = { sent: [], closes: [], send(text) { this.sent.push(JSON.parse(text)); }, close(code) { this.closes.push(code); },
      listen(handlers) { this.handlers = handlers; handlers.message(JSON.stringify(joined)); }, message(value) { this.handlers.message(JSON.stringify(value)); } }; wires.push(wire); return wire; } });
  return { client, clock, wires, seed, tickets: () => tickets, joined };
}
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test("shared client throttles trailing presence, resends at 15 seconds and refuses locally", async () => {
  const f = await fakeSession(), input = { cursor: null, selection: [], view: { x: 0, y: 0, width: 1, height: 1 }, active: true };
  const wire = f.wires[0]; f.client.setPresence(input); f.clock.advance(50); f.client.setPresence({ ...input, active: false });
  f.client.setPresence({ ...input, cursor: { x: 2, y: 3 } }); assert.equal(wire.sent.length, 1);
  f.clock.advance(50); assert.equal(wire.sent.length, 2); assert.deepEqual(wire.sent[1].cursor, { x: 2, y: 3 });
  f.clock.advance(14999); assert.equal(wire.sent.length, 2); f.clock.advance(1); assert.equal(wire.sent.length, 3);
  assert.equal(f.client.setPresence({ ...input, active: "yes" }), "bad_presence"); assert.equal(wire.sent.length, 3);
  f.client.close(); f.clock.advance(30000); assert.equal(wire.sent.length, 3); f.seed.destroy();
});

test("shared client refusal drops unsaved requests, clears undo and rejoins itself", async () => {
  const f = await fakeSession(), wire = f.wires[0];
  const first = f.client.edit(object(f.client.board, { x: 10 })), second = f.client.edit(object(f.client.board, { x: 20 }));
  wire.message({ kind: "refused", requestId: first, reason: "invalid_document" });
  assert.equal(f.client.edit(f.client.board), "join_required"); assert.equal(f.client.requests.get(first).state, "refused");
  assert.equal(f.client.requests.get(second).state, "dropped"); await tick();
  assert.equal(f.tickets(), 2); assert.equal(f.client.undo(), "nothing_to_undo"); assert.equal(f.client.board.objects[0].x, f.seed.doc.getMap("objects").get(f.client.board.objects[0].id).get("geometry").x);
  assert.deepEqual(wire.closes, [1000]); f.client.close(); f.seed.destroy();
});

test("resync drops received only, sends one combined request and leaves sent waiting", async () => {
  const f = await fakeSession(), wire = f.wires[0];
  const a = f.client.edit(object(f.client.board, { x: 10 })), b = f.client.edit(object(f.client.board, { x: 20 }));
  wire.message({ kind: "received", requestId: a }); wire.message({ kind: "resync", reason: "waiting_timeout", stateVector: encode(Y.encodeStateVector(f.seed.doc)) });
  assert.equal(f.client.requests.get(a).state, "dropped"); assert.equal(f.client.requests.get(b).state, "sent"); assert.equal(wire.sent.length, 3);
  const copy = adapter(Y.encodeStateAsUpdate(f.seed.doc)); Y.applyUpdate(copy.doc, decode(wire.sent[2].update)); assert.equal(readBoard(copy.doc).objects[0].x, 20);
  copy.destroy(); f.client.close(); f.seed.destroy();
});

test("oversize edits never send; unmatched refusals rejoin; presence refusals only report", async () => {
  const f = await fakeSession(), events = []; f.client.subscribe((event) => events.push(event)); const wire = f.wires[0];
  wire.message({ kind: "refused", reason: "bad_presence" }); assert.equal(f.tickets(), 1); assert.equal(events.at(-1).reason, "bad_presence");
  const pending = f.client.edit(object(f.client.board, { x: 10 })); wire.message({ kind: "refused", reason: "bad_message" });
  await tick(); assert.equal(f.tickets(), 2); assert.equal(f.client.requests.get(pending).state, "dropped");
  const nextWire = f.wires[1], id = f.client.edit(object(f.client.board, { text: "x".repeat(900000) }));
  assert.equal(f.client.requests.get(id).reason, "message_too_large"); assert.equal(nextWire.sent.length, 0);
  await tick(); const count = f.tickets(), closing = f.wires.at(-1); closing.handlers.close(4403); await tick();
  assert.equal(events.at(-1).code, 4403); assert.equal(f.tickets(), count); f.client.close(); f.seed.destroy();
});

test("all non-text property units, including equal later writes, follow save order", () => {
  const examples = {
    geometry: [{ x: 1, y: 2, width: 240, height: 240 }, { x: 3, y: 4, width: 300, height: 240 }],
    style: [{ color: "yellow", textSize: "small", align: "left" }, { color: "blue", textSize: "large", align: "center" }],
    marks: [[{ start: 0, end: 1, bold: true }], [{ start: 1, end: 2, italic: true }]],
    ends: [{ from: { object: "a", anchor: "auto" }, to: { object: "b", anchor: "auto" } },
      { from: { object: "a", anchor: "left" }, to: { object: "b", anchor: "right" } }],
    connectorStyle: [{ ...defaultConnectorStyle(), lineWeight: "thick" }, { ...defaultConnectorStyle(), lineColor: "#ff0000" }],
    order: [1, 2], group: [crypto.randomUUID(), crypto.randomUUID()], section: [crypto.randomUUID(), crypto.randomUUID()],
    shape: ["rectangle", "ellipse"], fill: [{ mode: "fill", color: "white" }, { mode: "none", color: "#ff0000" }],
    border: [{ style: "solid", color: "black" }, { style: "dashed", color: "white" }],
    kind: ["marker", "highlighter"], color: ["black", "white"], weight: ["thin", "thick"], points: [[[2, 2], [22, 22]], [[2, 2], [32, 32]]],
  };
  for (const key of [...Object.keys(examples), "title"]) for (const ids of [[10, 20], [20, 10]]) for (const reverse of [false, true]) for (const same of [false, true]) {
    const seed = new Y.Doc(); seed.getMap("board"); const m = new Y.Map(); seed.getMap("objects").set("object", m);
    m.set("type", "sticky"); m.set(key, "initial"); if (key === "title") seed.getMap("board").set(key, "initial");
    const values = key === "title" ? ["Left", "Right"] : examples[key];
    const updates = ids.map((id, i) => {
      const doc = new Y.Doc(); doc.getMap("board"); doc.getMap("objects"); Y.applyUpdate(doc, Y.encodeStateAsUpdate(seed)); doc.clientID = id;
      const vector = Y.encodeStateVector(doc), target = key === "title" ? doc.getMap("board") : doc.getMap("objects").get("object");
      target.set(key, same ? values[0] : values[i]); const update = Y.encodeStateAsUpdate(doc, vector); doc.destroy(); return update;
    });
    let current = seed; const order = reverse ? [1, 0] : [0, 1];
    for (const index of order) {
      const next = new Y.Doc(); next.getMap("board"); next.getMap("objects"); next.getMap("retired");
      Y.applyUpdate(next, Y.encodeStateAsUpdate(current)); Y.applyUpdate(next, updates[index]); promote(current, next, updates[index]);
      current.destroy(); current = next;
    }
    const target = key === "title" ? current.getMap("board") : current.getMap("objects").get("object");
    assert.deepEqual(target.get(key), values[same ? 0 : order[1]], key);
    const winner = target._map.get(key);
    // The later writer must own the winning identity, or the room must have
    // promoted it under its own identity, even when the value did not change.
    assert.notEqual(winner.id.client, ids[order[0]], key); current.destroy();
  }
});

test("a connector repaired away is recorded and cannot return under a new generation", () => {
  const initial = add(board(), "sticky", 100, 100), seed = adapter(initial), storage = new NodeStorage(":memory:"); initialize(storage);
  const a = adapter(Y.encodeStateAsUpdate(seed.doc)), b = adapter(Y.encodeStateAsUpdate(seed.doc));
  const n = initial.objects[0].id, m = initial.objects[1].id;
  let current = seed.doc; const docs = [];
  try {
    const deletion = evaluate(current, initial, update(a, (b) => deleted(b, [n])), storage); assert.equal(deletion.kind, "complete");
    current = deletion.doc; docs.push(current);
    let added;
    const dangling = evaluate(current, deletion.board, update(b, (b) => { added = connector(b, n, m); return added; }), storage);
    assert.equal(dangling.kind, "complete"); docs.push(dangling.doc);
    const removed = added.objects.at(-1); assert(dangling.identifiers.some((o) => o.id === removed.id && o.generation === removed.generation));
    for (const o of dangling.identifiers) storage.exec("INSERT OR IGNORE INTO identifiers VALUES (?, ?, 2)", o.id, o.generation);
    const c = adapter(Y.encodeStateAsUpdate(dangling.doc));
    const reused = evaluate(dangling.doc, dangling.board, update(c, (b) => {
      const next = add(b, "sticky", 0, 0); next.objects.at(-1).id = removed.id; return next;
    }), storage); assert.equal(reused.kind, "refused"); assert.equal(reused.reason, "identifier_reused"); c.destroy();
  } finally { a.destroy(); b.destroy(); seed.destroy(); docs.forEach((d) => d.destroy()); storage.close(); }
});

test("text undo skips the entire unit after another writer types", () => {
  const f = historyFixture(); f.own((b) => object(b, { text: "Mine" })); f.remote((b) => object(b, { text: "Mine plus theirs" }));
  assert.equal(f.take(), "changed_by_others"); assert.equal(f.board().objects[0].text, "Mine plus theirs"); f.a.destroy();
});
