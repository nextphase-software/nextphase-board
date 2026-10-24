// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { add, empty, validate } from "../apps/web/src/document.ts";
import { expandSelection, groupNumbers, groupObjects, groupReason, pressSelection, toggleGroup, ungroupObjects, wholeGroups } from "../apps/web/src/group.ts";
import { boundingBox, boxSelection, limitMove } from "../apps/web/src/selection.ts";

const editing = { readOnly: false, composing: false, pointerGesture: false, invalidObjectText: false };
function board() {
  let b = { ...empty(), title: "Synthetic groups" };
  for (let i = 0; i < 6; i++) b = add(b, i % 2 ? "text" : "sticky", i * 400, 0);
  return b;
}
const ids = (b, ...indexes) => new Set(indexes.map((i) => b.objects[i].id));
const groups = (b) => b.objects.map((o) => o.group);

for (const indexes of [[0, 1], [0, 2, 4, 5]]) {
  test(`Group assigns one fresh ID to ${indexes.length} objects and changes only membership`, () => {
    const b = board(), before = structuredClone(b), selection = ids(b, ...indexes);
    const next = groupObjects(b, selection), group = next.objects[indexes[0]].group;
    validate(next);
    assert.equal(typeof group, "string");
    assert(![b.boardId, ...b.objects.flatMap((o) => [o.id, o.generation])].includes(group));
    for (const [i, o] of next.objects.entries()) assert.deepEqual(o, { ...b.objects[i], group: selection.has(o.id) ? group : null });
    assert.deepEqual(b, before);
    assert.deepEqual(selection, ids(b, ...indexes));
  });
}

test("regrouping takes selected members only; remaining members retain their groups", () => {
  let b = board();
  b = groupObjects(b, ids(b, 0, 1));
  b = groupObjects(b, ids(b, 2, 3, 4));
  const before = structuredClone(b), next = groupObjects(b, ids(b, 0, 2, 5));
  const group = next.objects[0].group;
  assert.notEqual(group, b.objects[0].group);
  assert.notEqual(group, b.objects[2].group);
  assert.deepEqual(groups(next), [group, b.objects[1].group, group, b.objects[3].group, b.objects[4].group, group]);
  assert.deepEqual(b, before);
  validate(next);
});

for (const indexes of [[0, 1], [0], [1, 2, 5]]) {
  test(`Ungroup clears all touched groups from selection ${indexes}`, () => {
    let b = board();
    b = groupObjects(b, ids(b, 0, 1));
    b = groupObjects(b, ids(b, 2, 3));
    const before = structuredClone(b), selected = ids(b, ...indexes), next = ungroupObjects(b, selected);
    const touched = new Set(indexes.map((i) => b.objects[i].group).filter(Boolean));
    for (const [i, o] of next.objects.entries()) assert.deepEqual(o, { ...b.objects[i], group: touched.has(b.objects[i].group) ? null : b.objects[i].group });
    assert.deepEqual(b, before);
    assert.deepEqual(selected, ids(b, ...indexes));
  });
}

test("availability checks editing conditions first, then count, then already one whole group", () => {
  let b = board();
  b = groupObjects(b, ids(b, 0, 1, 2));
  const conditions = [
    ["readOnly", "Read-only: editing commands are unavailable."],
    ["composing", "Finish text composition before using editing commands."],
    ["pointerGesture", "Finish or cancel the pointer gesture before using editing commands."],
    ["invalidObjectText", "Correct invalid drafts before using editing commands."],
  ];
  for (const name of ["Group", "Ungroup"]) for (let i = 0; i < conditions.length; i++) {
    const state = { ...editing, ...Object.fromEntries(conditions.slice(i).map(([key]) => [key, true])) };
    for (const selected of [ids(b), ids(b, 0), ids(b, 0, 1, 2)]) assert.equal(groupReason(name, b, selected, state), conditions[i][1]);
  }
  for (const selected of [ids(b), ids(b, 0), ids(b, 5)]) assert.equal(groupReason("Group", b, selected, editing), "Select two or more objects to group.");
  assert.equal(groupReason("Group", b, ids(b, 0, 1), editing), "");
  assert.equal(groupReason("Group", b, ids(b, 0, 1, 2), editing), "The selected objects are already one group.");
  assert.equal(groupReason("Group", b, ids(b, 0, 1, 2, 3), editing), "");
  for (const selected of [ids(b), ids(b, 4, 5)]) assert.equal(groupReason("Ungroup", b, selected, editing), "Select a grouped object to ungroup.");
  assert.equal(groupReason("Ungroup", b, ids(b, 0), editing), "");
  assert.throws(() => groupObjects(b, ids(b, 0, 1, 2)), /already one group/);
  assert.throws(() => ungroupObjects(b, ids(b, 5)), /Select a grouped object/);
});

test("press and release expand groups except the already sole selected object; Shift toggles whole or partial groups", () => {
  let b = board();
  b = groupObjects(b, ids(b, 0, 2));
  const o = b.objects;
  assert.deepEqual(pressSelection(o, ids(b), o[0].id), ids(b, 0, 2));
  assert.deepEqual(pressSelection(o, ids(b, 0, 2, 3), o[0].id), ids(b, 0, 2));
  assert.deepEqual(pressSelection(o, ids(b, 0), o[0].id), ids(b, 0));
  assert.deepEqual(pressSelection(o, ids(b, 2), o[0].id), ids(b, 0, 2));
  assert.deepEqual(pressSelection(o, ids(b, 0), o[1].id), ids(b, 1));
  assert.deepEqual(toggleGroup(o, ids(b, 0, 2, 3), o[0].id), ids(b, 3));
  assert.deepEqual(toggleGroup(o, ids(b, 0, 3), o[0].id), ids(b, 0, 2, 3));
  assert.deepEqual(toggleGroup(o, ids(b, 3), o[2].id), ids(b, 0, 2, 3));
  assert.deepEqual(toggleGroup(o, ids(b, 3), o[3].id), ids(b));
});

test("box and Shift + box expand touched and previous members; a set move keeps all members together", () => {
  let b = board();
  b = groupObjects(b, ids(b, 0, 2));
  b = groupObjects(b, ids(b, 3, 5));
  const displayed = b.objects.map((o) => ({ ...o, displayHeight: o.height + 30 }));
  const corner = { x: displayed[2].x + displayed[2].width, y: displayed[2].y + displayed[2].displayHeight };
  const touched = boxSelection(corner, corner, displayed);
  assert.deepEqual(touched, [...ids(b, 2)]);
  const selected = expandSelection(b.objects, touched);
  assert.deepEqual(selected, ids(b, 0, 2));
  assert.deepEqual(expandSelection(b.objects, [...ids(b, 3), ...touched]), ids(b, 0, 2, 3, 5));
  assert.deepEqual(expandSelection(b.objects, []), ids(b));
  const delta = limitMove(b.objects.filter((o) => selected.has(o.id)), { x: 50, y: -70 });
  const moved = b.objects.map((o) => selected.has(o.id) ? { ...o, x: o.x + delta.x, y: o.y + delta.y } : o);
  for (const [i, o] of moved.entries()) assert.deepEqual(o, selected.has(o.id)
    ? { ...b.objects[i], x: b.objects[i].x + 50, y: b.objects[i].y - 70 } : b.objects[i]);
});

test("whole groups include singleton IDs, exclude partial groups, and use drawn bounds for outlines", () => {
  let b = board();
  b = groupObjects(b, ids(b, 0, 2));
  b = groupObjects(b, ids(b, 3, 4));
  // Taking one member leaves the old group as a valid singleton.
  b = groupObjects(b, ids(b, 4, 5));
  const displayed = b.objects.map((o) => ({ ...o, displayHeight: o.height + 200 }));
  const whole = wholeGroups(displayed, ids(b, 0, 2, 3, 4));
  assert.deepEqual([...whole.keys()], [b.objects[0].group, b.objects[3].group]);
  assert.deepEqual(whole.get(b.objects[0].group).map((o) => o.id), [...ids(b, 0, 2)]);
  assert.equal(whole.get(b.objects[3].group).length, 1);
  const box = boundingBox(whole.get(b.objects[0].group));
  assert.equal(box.height, displayed[0].displayHeight);
  assert.equal(box.width, displayed[2].x + displayed[2].width - displayed[0].x);
  assert.equal(wholeGroups(displayed, ids(b, 0)).size, 0);
});

test("numbering follows the lowest ordered member and counts singleton groups", () => {
  let b = board();
  b = groupObjects(b, ids(b, 3, 5));
  b = groupObjects(b, ids(b, 0, 4));
  b = groupObjects(b, ids(b, 2, 4));
  assert.deepEqual([...groupNumbers([...b.objects].reverse())], [
    [b.objects[0].group, 1], [b.objects[2].group, 2], [b.objects[3].group, 3],
  ]);
  assert.equal(groupNumbers(board().objects).size, 0);
});
