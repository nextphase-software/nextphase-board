// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { add, empty, validate } from "../packages/board-rules/src/document.ts";
import { Adapter } from "../packages/board-sync/src/document-adapter.ts";
import { deleteObject, duplicate, emptyHistory, record, redo, undo } from "../apps/web/src/history.ts";

const board = () => ({ ...empty(), title: "Synthetic planning board" });
const withoutGeneration = ({ generation, ...item }) => item;
// Count the adapter transactions that App adopts as draft revisions, rather than
// counting history-stack operations. Recording alone must never mutate the adapter.
function session(initial) {
  const adapter = new Adapter();
  adapter.set(initial);
  let revision = 0;
  adapter.doc.on("afterTransaction", () => revision++);
  return {
    board: initial, history: emptyHistory(),
    get revision() { return revision; },
    adopt(result) {
      validate(result.board);
      this.board = result.board;
      this.history = result.history;
      adapter.set(result.board);
    },
    record(next) {
      this.adopt({ board: next, history: record(this.history, this.board, next) });
    },
    close() { adapter.destroy(); },
  };
}

test("create, undo and redo each adopt one revision; resurrection retires and renews generations", () => {
  const s = session(board());
  const created = add(s.board, "sticky", 0, 0);
  const original = created.objects[0];
  s.record(created);
  assert.equal(s.revision, 1);
  assert.equal(s.history.past.length, 1);
  s.adopt(undo(s.board, s.history));
  assert.equal(s.revision, 2);
  assert.deepEqual(s.board.objects, []);
  assert.deepEqual(s.board.retiredGenerations, [original.generation]);
  s.adopt(redo(s.board, s.history));
  assert.equal(s.revision, 3);
  assert.deepEqual(withoutGeneration(s.board.objects[0]), withoutGeneration(original));
  assert.notEqual(s.board.objects[0].generation, original.generation);
  assert.deepEqual(s.board.retiredGenerations, [original.generation]);
  assert.equal(s.history.future.length, 0);
  s.close();
});

for (const kind of ["move", "text session"]) {
  test(`${kind} is one history step with one transaction per command`, () => {
    const initial = add(board(), "text", 0, 0);
    initial.objects[0].text = "First line\n你好 🧭";
    const s = session(initial);
    const next = {
      ...initial,
      objects: [{ ...initial.objects[0], ...(kind === "move"
        ? { x: 123, y: -456 }
        : { text: "Revised\ne\u0301 🧭" }) }],
    };
    s.record(next);
    assert.equal(s.revision, 1);
    assert.equal(s.history.past.length, 1);
    s.adopt(undo(s.board, s.history));
    assert.deepEqual(s.board, initial);
    assert.equal(s.revision, 2);
    s.adopt(redo(s.board, s.history));
    assert.deepEqual(s.board, next);
    assert.equal(s.revision, 3);
    assert.equal(s.board.objects[0].generation, initial.objects[0].generation);
    assert.deepEqual(s.board.retiredGenerations, []);
    s.close();
  });
}

test("duplicate copies content and geometry, is independent, and undoes/redoes once", () => {
  const initial = add(board(), "sticky", 0, 0);
  initial.objects[0].text = "Plan\n🧭";
  const s = session(initial);
  const source = initial.objects[0];
  const result = duplicate(s.board, s.history, source);
  s.adopt(result);
  assert.equal(s.revision, 1);
  const copy = s.board.objects[1];
  assert.equal(result.affectedId, copy.id);
  assert.notEqual(copy.id, source.id);
  assert.notEqual(copy.generation, source.generation);
  assert.notEqual(copy.id, copy.generation);
  assert.deepEqual(copy, {
    ...source, id: copy.id, generation: copy.generation,
    x: source.x + 24, y: source.y + 24, order: 1,
  });
  assert.deepEqual(s.board.objects[0], source);
  s.adopt(undo(s.board, s.history));
  assert.equal(s.revision, 2);
  assert.deepEqual(s.board.objects, initial.objects);
  assert.deepEqual(s.board.retiredGenerations, [copy.generation]);
  s.adopt(redo(s.board, s.history));
  assert.equal(s.revision, 3);
  const returned = s.board.objects[1];
  assert.deepEqual(withoutGeneration(returned), withoutGeneration(copy));
  assert.notEqual(returned.generation, copy.generation);
  assert.deepEqual(s.board.retiredGenerations, [copy.generation]);
  s.record({ ...s.board, objects: [source, { ...returned, text: "Independent edit", x: 999 }] });
  assert.deepEqual(s.board.objects[0], source);
  assert.equal(s.board.objects[1].text, "Independent edit");
  s.close();
});

test("delete restores logical identity and reading order with fresh generations, never reviving retired ones", () => {
  let initial = board();
  for (let i = 0; i < 3; i++) initial = add(initial, i === 1 ? "text" : "sticky", i * 50, 0);
  initial.objects[1].text = "Middle object";
  const s = session(initial);
  const target = initial.objects[1];
  s.adopt(deleteObject(s.board, s.history, target));
  assert.equal(s.revision, 1);
  assert.deepEqual(s.board.objects.map((o) => [o.id, o.order]), [
    [initial.objects[0].id, 0], [initial.objects[2].id, 1],
  ]);
  assert.deepEqual(s.board.retiredGenerations, [target.generation]);
  s.adopt(undo(s.board, s.history));
  assert.equal(s.revision, 2);
  const returned = s.board.objects[1];
  assert.deepEqual(withoutGeneration(returned), withoutGeneration(target));
  assert.notEqual(returned.generation, target.generation);
  assert.deepEqual(s.board.objects.map((o) => o.id), initial.objects.map((o) => o.id));
  assert.deepEqual(s.board.retiredGenerations, [target.generation]);
  assert.throws(() => deleteObject(s.board, s.history, target), /incarnation/);
  assert.throws(() => duplicate(s.board, s.history, target), /incarnation/);
  s.adopt(redo(s.board, s.history));
  assert.equal(s.revision, 3);
  assert.deepEqual(s.board.retiredGenerations, [target.generation, returned.generation].sort());
  assert.equal(s.board.objects.length, 2);
  s.close();
});

test("history survives mixed object operations and keeps unrelated title and generations", () => {
  const s = session(board());
  s.record(add(s.board, "text", 0, 0));
  const id = s.board.objects[0].id;
  s.record({ ...s.board, objects: [{ ...s.board.objects[0], text: "Session text" }] });
  s.record({ ...s.board, objects: [{ ...s.board.objects[0], x: 20 }] });
  s.adopt(deleteObject(s.board, s.history, s.board.objects[0]));
  s.board = { ...s.board, title: "Renamed outside history" };
  for (let i = 0; i < 4; i++) s.adopt(undo(s.board, s.history));
  assert.equal(s.board.objects.length, 0);
  assert.equal(s.board.retiredGenerations.length, 2);
  assert.equal(s.board.title, "Renamed outside history");
  for (let i = 0; i < 3; i++) s.adopt(redo(s.board, s.history));
  assert.equal(s.board.objects[0].id, id);
  assert.equal(s.board.objects[0].text, "Session text");
  assert.equal(s.board.objects[0].x, 20);
  assert.equal(s.board.retiredGenerations.length, 2);
  s.adopt(redo(s.board, s.history));
  assert.equal(s.board.retiredGenerations.length, 3);
  assert.equal(s.revision, 12);
  s.close();
});

test("history targeting a retired incarnation cannot edit its replacement", () => {
  const initial = add(board(), "text", 0, 0);
  const edited = { ...initial, objects: [{ ...initial.objects[0], text: "Changed" }] };
  const stale = record(emptyHistory(), initial, edited);
  const deleted = deleteObject(edited, stale, edited.objects[0]);
  const restored = undo(deleted.board, deleted.history);
  assert.throws(() => undo(restored.board, stale), /incarnation/);
  assert.equal(restored.board.objects[0].text, "Changed");
  const reverted = undo(restored.board, restored.history);
  assert.equal(reverted.board.objects[0].text, "");
  assert.equal(reverted.board.objects[0].generation, restored.board.objects[0].generation);
});

test("only the latest 100 steps remain; a new recorded change clears Redo", () => {
  const s = session(add(board(), "sticky", 0, 0));
  const startX = s.board.objects[0].x;
  for (let i = 1; i <= 101; i++) {
    s.record({ ...s.board, objects: [{ ...s.board.objects[0], x: startX + i }] });
  }
  assert.equal(s.history.past.length, 100);
  for (let i = 0; i < 100; i++) s.adopt(undo(s.board, s.history));
  assert.equal(s.board.objects[0].x, startX + 1);
  assert.throws(() => undo(s.board, s.history), /Nothing to undo/);
  assert.equal(s.history.future.length, 100);
  // Selection/view/title changes and unchanged sessions do not enter history.
  assert.equal(record(s.history, s.board, { ...s.board, title: "Another title" }), s.history);
  assert.equal(record(s.history, s.board, structuredClone(s.board)), s.history);
  s.record({ ...s.board, objects: [{ ...s.board.objects[0], text: "New direction" }] });
  assert.equal(s.history.future.length, 0);
  assert.throws(() => redo(s.board, s.history), /Nothing to redo/);
  s.close();
});

test("duplicate clamps to document bounds; 250 objects refuses duplicate and restoration atomically", () => {
  const edge = add(board(), "text", 1e6, 1e6);
  const copied = duplicate(edge, emptyHistory(), edge.objects[0]);
  validate(copied.board);
  assert.equal(copied.board.objects[1].x + copied.board.objects[1].width, 1e6);
  assert.equal(copied.board.objects[1].y + copied.board.objects[1].height, 1e6);
  let full = board();
  for (let i = 0; i < 250; i++) full = add(full, "sticky", 0, 0);
  const before = structuredClone(full);
  const h = emptyHistory();
  assert.throws(() => duplicate(full, h, full.objects[0]), /250 object limit/);
  assert.deepEqual(full, before);
  assert.deepEqual(h, emptyHistory());
  const removed = deleteObject(full, h, full.objects[100]);
  const filled = add(removed.board, "text", 0, 0);
  const snapshot = structuredClone({ board: filled, history: removed.history });
  assert.throws(() => undo(filled, removed.history), /250 object limit/);
  assert.deepEqual({ board: filled, history: removed.history }, snapshot);
});

test("retirement limit refuses delete, undo-create and redo-delete without changing board or history", () => {
  const initial = add(board(), "sticky", 0, 0);
  const full = { ...initial, retiredGenerations: Array.from({ length: 10000 }, () => crypto.randomUUID()).sort() };
  const h = record(emptyHistory(), { ...full, objects: [] }, full);
  const before = structuredClone({ board: full, history: h });
  assert.throws(() => deleteObject(full, h, full.objects[0]), /10,000 retired-generation limit/);
  assert.throws(() => undo(full, h), /10,000 retired-generation limit/);
  assert.deepEqual({ board: full, history: h }, before);
  const near = { ...initial, retiredGenerations: full.retiredGenerations.slice(0, 9999) };
  const deleted = deleteObject(near, emptyHistory(), near.objects[0]);
  assert.equal(deleted.board.retiredGenerations.length, 10000);
  const restored = undo(deleted.board, deleted.history);
  const snapshot = structuredClone(restored);
  assert.throws(() => redo(restored.board, restored.history), /10,000 retired-generation limit/);
  assert.deepEqual(restored, snapshot);
  assert.doesNotThrow(() => duplicate(restored.board, restored.history, restored.board.objects[0]));
});

for (const type of ["sticky", "text"]) {
  test(`${type} style changes are one step, preserve other content and skip a repeated value`, () => {
    const initial = add(add(board(), type, 0, 0), "text", 500, 0);
    initial.objects[0].text = "Unchanged\n你好 🧭";
    initial.objects[1] = { ...initial.objects[1], color: "blue", align: "right" };
    const s = session(initial);
    for (const change of [{ color: "green" }, { textSize: "small" }, { align: "center" }]) {
      const before = structuredClone(s.board);
      const next = { ...s.board, objects: [{ ...s.board.objects[0], ...change }, s.board.objects[1]] };
      const revisions = s.revision;
      const steps = s.history.past.length;
      s.record(next);
      assert.equal(s.revision, revisions + 1);
      assert.equal(s.history.past.length, steps + 1);
      s.adopt(undo(s.board, s.history));
      assert.deepEqual(s.board, before);
      assert.equal(s.revision, revisions + 2);
      s.adopt(redo(s.board, s.history));
      assert.deepEqual(s.board, next);
      assert.equal(s.revision, revisions + 3);
      assert.equal(s.board.objects[0].text, initial.objects[0].text);
      assert.deepEqual(s.board.objects[1], initial.objects[1]);
      const same = { ...s.board, objects: [{ ...s.board.objects[0], ...change }, s.board.objects[1]] };
      assert.equal(record(s.history, s.board, same), s.history);
      assert.equal(s.revision, revisions + 3);
    }
    s.close();
  });
}
test("size and growth undo and redo together, then duplicate and restore retain all styles", () => {
  const initial = add(add(board(), "sticky", 0, 0), "text", 500, 0);
  initial.objects[0] = { ...initial.objects[0], text: "One\nTwo\nThree\nFour\nFive", height: 160, color: "violet", align: "right" };
  const s = session(initial);
  const next = { ...initial, objects: [{ ...initial.objects[0], textSize: "extra-large", height: 272 }, initial.objects[1]] };
  s.record(next);
  assert.equal(s.revision, 1);
  assert.equal(s.history.past.length, 1);
  s.adopt(undo(s.board, s.history));
  assert.deepEqual(s.board, initial);
  s.adopt(redo(s.board, s.history));
  assert.deepEqual(s.board, next);
  assert.equal(s.revision, 3);
  s.adopt(duplicate(s.board, s.history, s.board.objects[0]));
  const copy = s.board.objects[2];
  assert.deepEqual(copy, { ...next.objects[0], id: copy.id, generation: copy.generation, x: next.objects[0].x + 24, y: next.objects[0].y + 24, order: 2 });
  s.adopt(deleteObject(s.board, s.history, copy));
  s.adopt(undo(s.board, s.history));
  assert.deepEqual(withoutGeneration(s.board.objects[2]), withoutGeneration(copy));
  assert.notEqual(s.board.objects[2].generation, copy.generation);
  assert.deepEqual(s.board.objects[0], next.objects[0]);
  assert.deepEqual(s.board.objects[1], initial.objects[1]);
  s.close();
});

test("finishing text before a style change yields separate steps; a no-op preserves redo", () => {
  const initial = add(board(), "sticky", 0, 0);
  const s = session(initial);
  const edited = { ...initial, objects: [{ ...initial.objects[0], text: "Text session" }] };
  s.record(edited);
  const styled = { ...edited, objects: [{ ...edited.objects[0], color: "blue" }] };
  s.record(styled);
  assert.equal(s.history.past.length, 2);
  assert.equal(s.revision, 2);
  s.adopt(undo(s.board, s.history));
  assert.deepEqual(s.board, edited);
  assert.equal(s.history.future.length, 1);
  assert.equal(record(s.history, s.board, structuredClone(s.board)), s.history);
  assert.equal(s.revision, 3);
  s.adopt(undo(s.board, s.history));
  assert.deepEqual(s.board, initial);
  s.adopt(redo(s.board, s.history));
  s.adopt(redo(s.board, s.history));
  assert.deepEqual(s.board, styled);
  assert.equal(s.revision, 6);
  s.close();
});

// W7 set operations extend the original single-object regression cases above.
const setBoard = () => {
  let initial = board();
  for (let i = 0; i < 5; i++) initial = add(initial, i % 2 ? "text" : "sticky", i * 400, i * 20);
  initial.objects[1].text = "One\nTwo\nThree\nFour\nFive";
  return initial;
};
const ids = (objects) => objects.map((o) => o.id);

for (const kind of ["move", "style with growth"]) {
  test(`set ${kind} is one step and revision, with exact undo/redo and untouched neighbours`, () => {
    const initial = setBoard(), s = session(initial);
    const next = { ...initial, objects: initial.objects.map((o, i) => i === 1 || i === 3
      ? { ...o, ...(kind === "move" ? { x: o.x + 37, y: o.y - 19 }
        : { color: "green", textSize: "extra-large", align: "right", height: i === 1 ? 272 : o.height }) } : o) };
    s.record(next);
    assert.equal(s.revision, 1);
    assert.equal(s.history.past.length, 1);
    const undone = undo(s.board, s.history);
    assert.deepEqual(undone.affectedIds, ids([initial.objects[1], initial.objects[3]]));
    assert.equal(undone.affectedId, initial.objects[1].id);
    s.adopt(undone);
    assert.deepEqual(s.board, initial);
    s.adopt(redo(s.board, s.history));
    assert.deepEqual(s.board, next);
    assert.equal(s.revision, 3);
    assert.equal(record(s.history, s.board, structuredClone(s.board)), s.history);
    s.close();
  });
}

test("set duplicate appends in source order, retires copies together and renews each generation", () => {
  const initial = setBoard(), s = session(initial);
  const sources = [initial.objects[3], initial.objects[1]];
  const copied = duplicate(s.board, s.history, sources);
  s.adopt(copied);
  const copies = s.board.objects.slice(5);
  assert.deepEqual(copied.affectedIds, ids(copies));
  assert.equal(copied.affectedId, copies[0].id);
  assert.equal(s.revision, 1);
  assert.equal(s.history.past.length, 1);
  for (const [i, source] of [...sources].reverse().entries()) {
    assert.deepEqual(copies[i], { ...source, id: copies[i].id, generation: copies[i].generation,
      x: source.x + 24, y: source.y + 24, order: 5 + i });
  }
  const identities = s.board.objects.flatMap((o) => [o.id, o.generation]);
  assert.equal(new Set(identities).size, identities.length);
  s.adopt(undo(s.board, s.history));
  assert.deepEqual(s.board.objects, initial.objects);
  assert.deepEqual(s.board.retiredGenerations, copies.map((o) => o.generation).sort());
  s.adopt(redo(s.board, s.history));
  assert.deepEqual(s.board.objects.slice(5).map(withoutGeneration), copies.map(withoutGeneration));
  for (const copy of s.board.objects.slice(5)) assert.ok(!copies.some((o) => o.generation === copy.generation));
  assert.equal(s.revision, 3);
  // A second cycle must target the new incarnations of every copy.
  s.adopt(undo(s.board, s.history));
  assert.equal(s.board.retiredGenerations.length, 4);
  s.adopt(redo(s.board, s.history));
  assert.deepEqual(s.board.objects.slice(5).map(withoutGeneration), copies.map(withoutGeneration));
  s.close();
});

test("set delete restores non-adjacent reading positions and retargets earlier set history", () => {
  const initial = setBoard(), s = session(initial);
  const targets = [initial.objects[1], initial.objects[3]];
  const moved = { ...initial, objects: initial.objects.map((o) => targets.some((t) => t.id === o.id)
    ? { ...o, x: o.x + 10 } : o) };
  s.record(moved);
  const result = deleteObject(s.board, s.history, [moved.objects[3], moved.objects[1]]);
  s.adopt(result);
  assert.deepEqual(result.affectedIds, ids(targets));
  assert.equal(s.revision, 2);
  assert.equal(s.history.past.length, 2);
  assert.deepEqual(ids(s.board.objects), ids(initial.objects.filter((o) => !ids(targets).includes(o.id))));
  assert.deepEqual(s.board.objects.map((o) => o.order), [0, 1, 2]);
  assert.deepEqual(s.board.retiredGenerations, targets.map((o) => o.generation).sort());
  s.adopt(undo(s.board, s.history));
  assert.deepEqual(s.board.objects.map(withoutGeneration), moved.objects.map(withoutGeneration));
  const renewed = s.board.objects.filter((o) => ids(targets).includes(o.id));
  for (const o of renewed) assert.ok(!targets.some((t) => t.generation === o.generation));
  s.adopt(undo(s.board, s.history));
  assert.deepEqual(s.board.objects.map(withoutGeneration), initial.objects.map(withoutGeneration));
  s.adopt(redo(s.board, s.history));
  s.adopt(redo(s.board, s.history));
  assert.deepEqual(ids(s.board.objects), ids(initial.objects.filter((o) => !ids(targets).includes(o.id))));
  assert.deepEqual(s.board.retiredGenerations, [...targets, ...renewed].map((o) => o.generation).sort());
  assert.equal(s.revision, 6);
  s.close();
});

test("set capacity and retirement limits refuse the entire command without mutation", () => {
  let full = board();
  for (let i = 0; i < 249; i++) full = add(full, "sticky", 0, 0);
  const h = emptyHistory(), targets = full.objects.slice(0, 2);
  const before = structuredClone({ board: full, history: h });
  assert.throws(() => duplicate(full, h, targets), /250 object limit/);
  assert.deepEqual({ board: full, history: h }, before);
  const deleted = deleteObject(full, h, targets);
  const filled = add(add(deleted.board, "text", 0, 0), "sticky", 0, 0);
  const snapshot = structuredClone({ board: filled, history: deleted.history });
  assert.throws(() => undo(filled, deleted.history), /250 object limit/);
  assert.deepEqual({ board: filled, history: deleted.history }, snapshot);
  const near = { ...setBoard(), retiredGenerations: Array.from({ length: 9999 }, () => crypto.randomUUID()).sort() };
  const nearBefore = structuredClone({ board: near, history: h });
  assert.throws(() => deleteObject(near, h, near.objects.slice(0, 2)), /10,000 retired-generation limit/);
  assert.deepEqual({ board: near, history: h }, nearBefore);
  const room = { ...near, retiredGenerations: near.retiredGenerations.slice(0, 9998) };
  const removed = deleteObject(room, h, room.objects.slice(0, 2));
  assert.equal(removed.board.retiredGenerations.length, 10000);
  const restored = undo(removed.board, removed.history);
  const restoredBefore = structuredClone(restored);
  assert.throws(() => redo(restored.board, restored.history), /10,000 retired-generation limit/);
  assert.deepEqual(restored, restoredBefore);
  const created = duplicate(near, h, near.objects.slice(0, 2));
  const createdBefore = structuredClone(created);
  assert.throws(() => undo(created.board, created.history), /10,000 retired-generation limit/);
  assert.deepEqual(created, createdBefore);
});

test("one stale member refuses every member of a set command and history step", () => {
  const initial = setBoard();
  const next = { ...initial, objects: initial.objects.map((o, i) => i < 2 ? { ...o, x: o.x + 10 } : o) };
  const history = record(emptyHistory(), initial, next);
  const replaced = { ...next, objects: next.objects.map((o, i) => i === 1 ? { ...o, generation: crypto.randomUUID() } : o) };
  const snapshot = structuredClone({ board: replaced, history });
  assert.throws(() => undo(replaced, history), /incarnation/);
  assert.throws(() => duplicate(replaced, history, next.objects.slice(0, 2)), /incarnation/);
  assert.throws(() => deleteObject(replaced, history, next.objects.slice(0, 2)), /incarnation/);
  assert.deepEqual({ board: replaced, history }, snapshot);
  const reverted = undo(next, history);
  const staleRedo = { ...reverted.board, objects: reverted.board.objects.map((o, i) => i === 1 ? { ...o, generation: crypto.randomUUID() } : o) };
  const redoBefore = structuredClone({ board: staleRedo, history: reverted.history });
  assert.throws(() => redo(staleRedo, reverted.history), /incarnation/);
  assert.deepEqual({ board: staleRedo, history: reverted.history }, redoBefore);
});

test("a set step counts once toward the 100-step limit and no-op preserves redo", () => {
  const initial = setBoard(), s = session(initial);
  for (let i = 1; i <= 101; i++) s.record({ ...s.board, objects: s.board.objects.map((o, index) =>
    index < 2 ? { ...o, x: initial.objects[index].x + i } : o) });
  assert.equal(s.history.past.length, 100);
  assert.equal(s.revision, 101);
  for (let i = 0; i < 100; i++) s.adopt(undo(s.board, s.history));
  assert.equal(s.board.objects[0].x, initial.objects[0].x + 1);
  assert.equal(s.board.objects[1].x, initial.objects[1].x + 1);
  assert.deepEqual(s.board.objects.slice(2), initial.objects.slice(2));
  assert.equal(s.history.future.length, 100);
  assert.equal(s.revision, 201);
  assert.equal(record(s.history, s.board, structuredClone(s.board)), s.history);
  s.record({ ...s.board, objects: s.board.objects.map((o, i) => i < 2 ? { ...o, align: "right" } : o) });
  assert.equal(s.history.future.length, 0);
  assert.equal(s.revision, 202);
  s.close();
});

// W9 order steps opt in explicitly; every earlier call form stays unchanged.
for (const name of ["Bring to front", "Bring forward", "Send backward", "Send to back"]) {
  test(`${name} records selected orders only and restores the whole order exactly`, async () => {
    const { arrangeOrder } = await import("../apps/web/src/arrange.ts");
    const initial = setBoard(), s = session(initial);
    const selected = new Set([initial.objects[0].id, initial.objects[2].id, initial.objects[4].id]);
    const next = { ...initial, objects: arrangeOrder(name, initial.objects, selected) };
    const h = record(s.history, initial, next, [...selected]);
    assert.equal(h.past.length, 1);
    assert.deepEqual(h.past[0].changes.map((c) => c.before.id), [...selected]);
    for (const c of h.past[0].changes) {
      assert.deepEqual(c.before, initial.objects.find((o) => o.id === c.before.id));
      assert.deepEqual(c.after, next.objects.find((o) => o.id === c.after.id));
    }
    s.adopt({ board: next, history: h });
    assert.equal(s.revision, 1);
    const undone = undo(s.board, s.history);
    assert.deepEqual(undone.affectedIds, [...selected]);
    s.adopt(undone);
    assert.deepEqual(s.board, initial);
    s.adopt(redo(s.board, s.history));
    assert.deepEqual(s.board, next);
    assert.equal(s.revision, 3);
    assert.equal(record(s.history, s.board, structuredClone(s.board), [...selected]), s.history);
    // Removing selected members still ignores every following renumbered neighbour.
    const removed = deleteObject(s.board, s.history, s.board.objects.filter((o) => selected.has(o.id)));
    assert.deepEqual(new Set(removed.history.past.at(-1).changes.map((c) => c.before.id)), selected);
    s.adopt(removed);
    s.adopt(undo(s.board, s.history));
    s.adopt(undo(s.board, s.history));
    assert.deepEqual(s.board.objects.map(withoutGeneration), initial.objects.map(withoutGeneration));
    s.adopt(redo(s.board, s.history));
    assert.deepEqual(s.board.objects.map(withoutGeneration), next.objects.map(withoutGeneration));
    s.close();
  });
}

test("align positions use one ordinary step with exact undo/redo and no size changes", async () => {
  const { arrangePositions } = await import("../apps/web/src/arrange.ts");
  const initial = setBoard(), s = session(initial);
  const selected = initial.objects.slice(1, 4);
  const positions = arrangePositions("Align objects bottom", selected.map((o, i) => ({ ...o, displayHeight: o.height + i * 50 })));
  const next = { ...initial, objects: initial.objects.map((o) => {
    const p = positions.find((p) => p.id === o.id);
    return p ? { ...o, x: p.x, y: p.y } : o;
  }) };
  s.record(next);
  assert.equal(s.history.past.length, 1);
  assert.equal(s.revision, 1);
  for (const o of next.objects) assert.equal(o.height, initial.objects.find((v) => v.id === o.id).height);
  s.adopt(undo(s.board, s.history));
  assert.deepEqual(s.board, initial);
  s.adopt(redo(s.board, s.history));
  assert.deepEqual(s.board, next);
  assert.equal(s.revision, 3);
  assert.equal(record(s.history, next, structuredClone(next)), s.history);
  s.close();
});

test("order-only changes remain ignored by legacy recording and removal excludes renumbering", async () => {
  const { arrangeOrder } = await import("../apps/web/src/arrange.ts");
  const initial = setBoard(), history = emptyHistory();
  const next = { ...initial, objects: arrangeOrder("Bring to front", initial.objects, new Set([initial.objects[1].id])) };
  assert.equal(record(history, initial, next), history);
  const removed = deleteObject(initial, history, initial.objects[1]);
  assert.equal(removed.history.past.length, 1);
  assert.equal(removed.history.past[0].changes.length, 1);
  assert.deepEqual(removed.history.past[0].changes[0], { before: initial.objects[1], after: null });
  const undone = undo(removed.board, removed.history);
  assert.deepEqual(undone.board.objects.map(withoutGeneration), initial.objects.map(withoutGeneration));
});

for (const name of ["Group", "Ungroup"]) test(`${name} is one transaction and history step with exact undo and redo`, async () => {
  const { groupObjects, ungroupObjects } = await import("../apps/web/src/group.ts");
  let initial = setBoard();
  initial = groupObjects(initial, new Set(initial.objects.slice(0, 2).map((o) => o.id)));
  const s = session(initial);
  const selection = new Set([initial.objects[0].id, initial.objects[2].id]);
  const next = name === "Group" ? groupObjects(initial, selection) : ungroupObjects(initial, selection);
  s.record(next);
  assert.equal(s.revision, 1);
  assert.equal(s.history.past.length, 1);
  const changed = initial.objects.filter((o, i) => o.group !== next.objects[i].group).map((o) => o.id);
  assert.deepEqual(s.history.past[0].changes.map((c) => c.before.id), changed);
  const reverted = undo(s.board, s.history);
  assert.deepEqual(reverted.affectedIds, changed);
  s.adopt(reverted);
  assert.equal(s.revision, 2);
  assert.deepEqual(s.board, initial);
  s.adopt(redo(s.board, s.history));
  assert.equal(s.revision, 3);
  assert.deepEqual(s.board, next);
  s.close();
});

test("Duplicate gives each whole group its own fresh ID and leaves partial and ungrouped copies null", async () => {
  const { groupObjects } = await import("../apps/web/src/group.ts");
  let initial = setBoard();
  initial = groupObjects(initial, new Set(initial.objects.slice(0, 2).map((o) => o.id)));
  initial = groupObjects(initial, new Set(initial.objects.slice(2, 4).map((o) => o.id)));
  // A singleton is still a whole group when copied.
  initial.objects[4].group = crypto.randomUUID();
  const full = duplicate(initial, emptyHistory(), initial.objects);
  const copies = full.board.objects.slice(initial.objects.length);
  assert.equal(copies[0].group, copies[1].group);
  assert.equal(copies[2].group, copies[3].group);
  assert.equal(new Set(copies.map((o) => o.group)).size, 3);
  const originals = new Set([initial.boardId, ...initial.retiredGenerations,
    ...initial.objects.flatMap((o) => [o.id, o.generation, o.group])]);
  for (const o of copies) for (const id of [o.id, o.generation, o.group]) assert(!originals.has(id));
  assert.equal(new Set(copies.flatMap((o) => [o.id, o.generation])).size, copies.length * 2);
  assert(copies.every((o) => !copies.some((other) => other.id === o.group || other.generation === o.group)));
  validate(full.board);
  const reverted = undo(full.board, full.history);
  assert.deepEqual(reverted.board.objects, initial.objects);
  const reapplied = redo(reverted.board, reverted.history);
  assert.deepEqual(reapplied.board.objects.slice(initial.objects.length).map(withoutGeneration), copies.map(withoutGeneration));
  validate(reapplied.board);
  const partial = duplicate(initial, emptyHistory(), [initial.objects[0], initial.objects[2]]);
  assert.deepEqual(partial.board.objects.slice(initial.objects.length).map((o) => o.group), [null, null]);
  const plain = add(initial, "text", 900, 0);
  const ungrouped = duplicate(plain, emptyHistory(), plain.objects.at(-1));
  assert.equal(ungrouped.board.objects.at(-1).group, null);
  const removed = deleteObject(initial, emptyHistory(), initial.objects[0]);
  assert.equal(removed.board.objects[0].group, initial.objects[1].group);
  const restored = undo(removed.board, removed.history);
  assert.deepEqual(restored.board.objects.map(withoutGeneration), initial.objects.map(withoutGeneration));
  validate(restored.board);
});

test("fresh IDs for add, grouping, duplicate and resurrection avoid group IDs and all same-command IDs", async (t) => {
  const { groupObjects } = await import("../apps/web/src/group.ts");
  let initial = setBoard();
  initial = groupObjects(initial, new Set(initial.objects.slice(0, 2).map((o) => o.id)));
  initial = groupObjects(initial, new Set(initial.objects.slice(2, 4).map((o) => o.id)));
  initial.retiredGenerations = [crypto.randomUUID()];
  const random = crypto.randomUUID.bind(crypto);
  const forbidden = [initial.boardId, ...initial.retiredGenerations,
    ...initial.objects.flatMap((o) => [o.id, o.generation, ...(o.group ? [o.group] : [])])];
  let sequence = [];
  t.mock.method(crypto, "randomUUID", () => sequence.length ? sequence.shift() : random());
  const a = random(), b = random();
  sequence = [...forbidden, a, ...forbidden, a, b];
  const added = add(initial, "text", 0, 0);
  assert.equal(added.objects.at(-1).id, a);
  assert.equal(added.objects.at(-1).generation, b);
  assert.equal(sequence.length, 0);
  const g = random();
  sequence = [...forbidden, g];
  const grouped = groupObjects(initial, new Set(initial.objects.map((o) => o.id)));
  assert(grouped.objects.every((o) => o.group === g));
  assert.equal(sequence.length, 0);
  const g1 = random(), g2 = random(), id1 = random(), gen1 = random(), id2 = random(), gen2 = random();
  sequence = [...forbidden, g1, ...forbidden, g1, g2,
    ...forbidden, g1, g2, id1, g1, g2, id1, gen1, id1, gen1, id2, id2, gen2];
  const copied = duplicate(initial, emptyHistory(), initial.objects.slice(0, 4));
  const copies = copied.board.objects.slice(initial.objects.length);
  assert.equal(copies[0].group, g1);
  assert.equal(copies[2].group, g2);
  assert.equal(copies[0].id, id1);
  assert.equal(copies[0].generation, gen1);
  assert.equal(copies[1].id, id2);
  assert.equal(copies[1].generation, gen2);
  assert.equal(sequence.length, 0);
  validate(copied.board);
  const removed = deleteObject(initial, emptyHistory(), initial.objects.slice(0, 2));
  const fresh = random(), fresh2 = random();
  sequence = [...forbidden, fresh, fresh, fresh2];
  const restored = undo(removed.board, removed.history);
  assert.equal(restored.board.objects[0].generation, fresh);
  assert.equal(restored.board.objects[1].generation, fresh2);
  assert.equal(sequence.length, 0);
  validate(restored.board);
});
