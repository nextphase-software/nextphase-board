// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { add, empty, validate } from "../packages/board-rules/src/document.ts";
import { checkTransition } from "../packages/board-rules/src/transition.ts";
const fixture = () => add({ ...empty(), title: "Transition" }, "text", 0, 0);
function refused(before, after) {
  validate(before); validate(after);
  assert.throws(() => checkTransition(before, after), /invalid_transition/);
}
test("normal changes, insertion and removal with retirement pass", () => {
  const before = fixture(), after = add(before, "text", 100, 100);
  after.objects[0] = { ...after.objects[0], text: "Edited", x: 200 };
  checkTransition(before, after);
  checkTransition(after, { ...after, objects: [], retiredGenerations: after.objects.map((o) => o.generation).sort() });
});
test("transition 1: board identity and schema cannot change", () => {
  const before = fixture();
  refused(before, { ...before, boardId: crypto.randomUUID() });
  refused(before, { ...before, schemaVersion: 9 });
});
test("transition 2: retirement is permanent", () => {
  const before = { ...fixture(), retiredGenerations: [crypto.randomUUID()] };
  refused(before, { ...before, retiredGenerations: [] });
});
test("transition 3: a live object keeps generation and type", () => {
  const before = fixture();
  refused(before, { ...before, objects: [{ ...before.objects[0], generation: crypto.randomUUID() }] });
  refused(before, { ...before, objects: [{ ...before.objects[0], type: "sticky" }] });
});
test("transition 4: a retired generation cannot be an object id", () => {
  const before = { ...fixture(), retiredGenerations: [crypto.randomUUID()] };
  const after = add(before, "text", 100, 100);
  after.objects[1].id = before.retiredGenerations[0];
  refused(before, after);
});
test("transition 5: new objects cannot reuse either previous identifier", () => {
  const before = fixture();
  const after = fixture();
  after.boardId = before.boardId;
  after.objects[0].id = before.objects[0].generation;
  after.retiredGenerations = [before.objects[0].generation];
  refused(before, after);
});
test("transition 6: deletion retires its generation", () => {
  const before = fixture();
  refused(before, { ...before, objects: [] });
});
