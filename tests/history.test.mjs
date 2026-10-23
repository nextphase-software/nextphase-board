// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { Adapter, add, empty, validate } from "../apps/web/src/document.ts";
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
