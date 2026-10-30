// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { add, canonical, empty, validate } from "../packages/board-rules/src/document.ts";
import { Adapter } from "../packages/board-sync/src/document-adapter.ts";
import { assignSection, bandOrder, drawRectangle, dropTargets, dropped, moveWithMembers,
  objectLabel, orderInBands, orderParticipants, placeObject, remapSection, sectionAt,
  withMembers, wrapReason, wrapSelection } from "../apps/web/src/sections.ts";
import { deleteObject, duplicate, emptyHistory, record, redo, undo } from "../apps/web/src/history.ts";
import { buildPaste, buildSnapshot } from "../apps/web/src/clipboard.ts";
import { groupObjects, groupReason, groupNumbers } from "../apps/web/src/group.ts";
import { resizeObject, resizeSet } from "../apps/web/src/resize.ts";

const editable = { readOnly: false, composing: false, pointerGesture: false, invalidObjectText: false };
const ids = (...objects) => new Set(objects.flat().map((o) => o.id));
const base = () => ({ ...empty(), title: "Synthetic sections" });
const drawn = (b) => b.objects.map((o) => ({ ...o, displayHeight: o.height }));
function object(b, type, rectangle = {}) {
  return { ...add(b, type, 0, 0).objects.at(-1), ...rectangle };
}
function fixture() {
  let b = base();
  const section = object(b, "section", { x: 0, y: 0, width: 640, height: 480, text: "Plan" });
  b = placeObject(b, section);
  const a = object(b, "sticky", { x: 40, y: 40, width: 240, height: 240, text: "Idea" });
  b = placeObject(b, a);
  const c = object(b, "text", { x: 350, y: 80, width: 240, height: 120, text: "Other" });
  b = placeObject(b, c);
  const outside = object(b, "sticky", { x: 800, y: 0 });
  b = placeObject(b, outside);
  return { b, section: b.objects[0], a: b.objects[1], c: b.objects[2], outside: b.objects[3] };
}
const view = { centerX: 0, centerY: 0, zoom: 1, width: 4000, height: 4000 };
const content = (b) => b.objects.map(({ generation, ...o }) => o);
function exactUndo(before, after, selected) {
  const h = record(emptyHistory(), before, after, selected && [...selected]);
  assert.equal(h.past.length, 1);
  const result = undo(after, h);
  assert.deepEqual(content(result.board), content(before));
  validate(result.board);
  return result;
}

test("v5 validates section links, styles, names and per-type geometry without inferring membership", () => {
  const { b, section } = fixture();
  for (const text of ["", "Same\nSame", "🧭".repeat(100)]) {
    const valid = { ...b, objects: b.objects.map((o) => o.id === section.id ? { ...o, text } : o) };
    assert.deepEqual(validate(JSON.parse(canonical(valid))), valid);
  }
  for (const mutate of [
    (x) => x.objects[0].section = x.objects[0].id,
    (x) => x.objects[0].section = x.objects[1].id,
    (x) => x.objects[1].section = x.objects[1].id,
    (x) => x.objects[1].section = x.objects[2].id,
    (x) => x.objects[1].section = crypto.randomUUID(),
    (x) => x.objects[1].section = 1,
    (x) => delete x.objects[1].section,
    (x) => x.objects[0].group = crypto.randomUUID(),
    (x) => x.objects[0].marks = [{ start: 0, end: 1, bold: true }],
    (x) => x.objects[0].textSize = "large",
    (x) => x.objects[0].align = "center",
    (x) => x.objects[0].text = "🧭".repeat(101),
    (x) => x.objects[0].width = 199,
    (x) => x.objects[0].height = 10001,
    (x) => x.objects[1].width = 39,
    (x) => x.objects[1].height = 2001,
  ]) {
    const invalid = structuredClone(b); mutate(invalid);
    const before = structuredClone(invalid);
    assert.throws(() => validate(invalid)); assert.deepEqual(invalid, before);
  }
  for (const size of [200, 10000]) {
    const valid = structuredClone(b); valid.objects[0].width = size; valid.objects[0].height = size;
    assert.doesNotThrow(() => validate(valid));
  }
  const stored = structuredClone(b);
  stored.objects[1].section = null;
  stored.objects[2].x = 2000;
  const opened = validate(JSON.parse(canonical(stored)));
  assert.equal(opened.objects[1].section, null); assert.equal(opened.objects[2].section, section.id);
  assert.deepEqual(opened, stored);
});

test("adapter updates membership and geometry atomically and recreates stored membership", () => {
  const { b, a } = fixture(), adapter = new Adapter(); adapter.set(b);
  const map = adapter.doc.getMap("objects").get(a.id), text = map.get("text");
  const keys = []; map.observe((e) => keys.push([...e.keysChanged].sort()));
  let transactions = 0; adapter.doc.on("afterTransaction", () => transactions++);
  const changed = { ...b, objects: b.objects.map((o) => o.id === a.id ? { ...o, x: 900, section: null } : o) };
  adapter.set(changed);
  assert.equal(transactions, 1); assert.deepEqual(keys, [["geometry", "section"]]);
  assert.equal(map.get("section"), null); assert.equal(map.get("text"), text);
  const reopened = new Adapter(); reopened.set(validate(JSON.parse(canonical(b))));
  assert.equal(reopened.doc.getMap("objects").get(a.id).get("section"), b.objects[0].id);
  adapter.destroy(); reopened.destroy();
});

for (const type of ["sticky", "text"]) test(`placing ${type} joins by its saved centre, outside stays unassigned`, () => {
  const { b, section } = fixture();
  const inside = object(b, type, { x: -100, y: -40 });
  assert.equal(placeObject(b, inside).objects.find((o) => o.id === inside.id).section, section.id);
  const outside = object(b, type, { x: 1000, y: 1000 });
  assert.equal(placeObject(b, outside).objects.at(-1).section, null);
});

test("drawing clamps each size, supports reverse drags and keeps the rectangle on the board", () => {
  assert.deepEqual(drawRectangle({ x: 700, y: 500 }, { x: 0, y: 0 }), { x: 0, y: 0, width: 700, height: 500 });
  assert.deepEqual(drawRectangle({ x: 1e6, y: 1e6 }, { x: 1e6 + 3, y: 1e6 + 1 }),
    { x: 999800, y: 999800, width: 200, height: 200 });
  assert.deepEqual(drawRectangle({ x: -2e6, y: -2e6 }, { x: 2e6, y: 2e6 }),
    { x: -1e6, y: -1e6, width: 10000, height: 10000 });
});

for (const route of ["draw", "click", "Enter", "Add section", "Section from selection"]) {
  test(`${route} takes in covered ideas, including another section's member, in one undoable step`, () => {
    const { b, a, c, outside } = fixture();
    const before = structuredClone(b);
    b.objects.find((o) => o.id === c.id).section = null;
    let result, id;
    if (route === "Section from selection") ({ board: result, id } = wrapSelection(b, ids(a, c), drawn(b)));
    else {
      const rectangle = route === "draw" ? drawRectangle({ x: 0, y: 0 }, { x: 640, y: 480 })
        : { x: 0, y: 0, width: 640, height: 480 };
      const newSection = object(b, "section", rectangle); id = newSection.id;
      result = placeObject(b, newSection);
    }
    assert.equal(result.objects.find((o) => o.id === a.id).section, id);
    assert.equal(result.objects.find((o) => o.id === c.id).section, id);
    assert.deepEqual({ ...result.objects.find((o) => o.id === outside.id), order: outside.order }, b.objects.find((o) => o.id === outside.id));
    exactUndo(b, result); validate(result);
    assert.equal(before.objects[1].section, b.objects[1].section);
    const emptySection = object(b, "section", { x: -1000, y: -1000 });
    const emptyResult = placeObject(b, emptySection);
    assert(emptyResult.objects.filter((o) => o.type !== "section").every((o) => o.section === b.objects.find((x) => x.id === o.id).section));
  });
}

test("drop joins, leaves, includes edges and prefers the topmost overlapping section", () => {
  const { b, section, outside } = fixture();
  let moved = moveWithMembers(b, ids(outside), -800, 0);
  assert.equal(dropTargets(moved, ids(outside)).get(outside.id), section.id);
  const joined = dropped(moved, ids(outside));
  assert.equal(joined.objects.find((o) => o.id === outside.id).section, section.id);
  moved = moveWithMembers(joined, ids(outside), 800, 0);
  assert.equal(dropped(moved, ids(outside)).objects.find((o) => o.id === outside.id).section, null);
  const edge = { ...b, objects: b.objects.map((o) => o.id === outside.id ? { ...o, x: 520, y: 360 } : o) };
  assert.equal(dropTargets(edge, ids(outside)).get(outside.id), section.id);
  const top = object(b, "section", { ...section, id: crypto.randomUUID(), generation: crypto.randomUUID(), text: "Top" });
  const overlapping = placeObject(b, top);
  assert.equal(sectionAt(overlapping.objects, { x: 120, y: 120 }).id, top.id);
});

test("whole groups join at their shared saved centre, straddling an edge; a member alone uses its own centre", () => {
  let { b, a, c, section } = fixture();
  b = groupObjects(b, ids(a, c));
  b.objects = b.objects.map((o) => o.id === a.id ? { ...o, x: 450, width: 100 } : o.id === c.id ? { ...o, x: 700, width: 100 } : o);
  const both = dropTargets(b, ids(a, c));
  assert.equal(both.get(a.id), section.id); assert.equal(both.get(c.id), section.id);
  assert.equal(dropTargets(b, ids(c)).get(c.id), null);
  assert.equal(groupReason("Group", b, ids(section, a), editable), "Sections cannot be grouped.");
  assert.equal(groupReason("Group", b, ids(section), { ...editable, readOnly: true }), "Read-only: editing commands are unavailable.");
});

test("carried group members keep their section while the rest of the moving group drops independently", () => {
  let { b, a, c, section } = fixture();
  b = groupObjects(b, ids(a, c)); b = assignSection(b, ids(c), null);
  const moved = moveWithMembers(b, ids(section, c), 1000, 0);
  const result = dropped(moved, withMembers(b.objects, ids(section, c)));
  assert.equal(result.objects.find((o) => o.id === a.id).section, section.id);
  assert.equal(result.objects.find((o) => o.id === c.id).section, section.id);
});

test("wrap uses drawn bounds with 40-unit margins, clamping, explicit selected membership and ordered refusal reasons", () => {
  const { b, a, section } = fixture();
  const rectangles = drawn(b).map((o) => o.id === a.id ? { ...o, displayHeight: 400 } : o);
  const result = wrapSelection(b, ids(a), rectangles), frame = result.board.objects.find((o) => o.id === result.id);
  assert.deepEqual([frame.x, frame.y, frame.width, frame.height], [0, 0, 320, 480]);
  const edge = { ...b, objects: b.objects.map((o) => o.id === a.id ? { ...o, x: -1e6, y: -1e6 } : o) };
  const wrapped = wrapSelection(edge, ids(a), drawn(edge));
  assert.equal(wrapped.board.objects.find((o) => o.id === wrapped.id).x, -1e6);
  const large = drawn(b).map((o) => ({ ...o, displayHeight: 10001 }));
  const reasons = [
    [new Set(), { ...editable, readOnly: true }, "Read-only: editing commands are unavailable."],
    [new Set(), { ...editable, composing: true }, "Finish text composition before using editing commands."],
    [new Set(), { ...editable, pointerGesture: true }, "Finish or cancel the pointer gesture before using editing commands."],
    [new Set(), { ...editable, invalidObjectText: true }, "Correct invalid drafts before using editing commands."],
    [new Set(), editable, "Select an object to duplicate or delete."],
    [ids(section, a), editable, "Sections cannot contain sections."],
    [ids(a), editable, "The selection with its margin exceeds the 10,000-unit section limit."],
  ];
  for (const [selection, state, expected] of reasons) assert.equal(wrapReason(b, selection, large, state), expected);
  const full = { ...b, objects: [...b.objects, ...Array.from({ length: 246 }, () => ({ ...a, id: crypto.randomUUID() }))] };
  assert.equal(wrapReason(full, ids(a), large), "250 object limit reached");
  assert.equal(wrapReason(full, ids(section), large), "Sections cannot contain sections.");
  const before = structuredClone(b);
  assert.throws(() => wrapSelection(b, ids(section), drawn(b)), /Sections cannot contain/);
  assert.deepEqual(b, before);
});

test("moves include members once, share a board limit, leave outsiders fixed and preserve links without a drop", () => {
  const { b, section, a, c, outside } = fixture();
  assert.deepEqual(withMembers(b.objects, ids(section, a)), ids(section, a, c));
  const moved = moveWithMembers(b, ids(section, a), 10, 20);
  for (const o of b.objects) {
    const next = moved.objects.find((x) => x.id === o.id);
    assert.equal(next.x, o.x + (o.id === outside.id ? 0 : 10));
    assert.equal(next.y, o.y + (o.id === outside.id ? 0 : 20));
    assert.equal(next.section, o.section);
  }
  const edge = { ...b, objects: b.objects.map((o) => o.id === a.id ? { ...o, x: 1e6 - o.width - 2 } : o) };
  const limited = moveWithMembers(edge, ids(section), 1000, 0);
  for (const o of edge.objects.filter((o) => o.id !== outside.id)) assert.equal(limited.objects.find((x) => x.id === o.id).x, o.x + 2);
  assert.equal(moveWithMembers(limited, ids(section), 1, 0), limited);
});

test("one undo and redo restores a drop's positions and membership together", () => {
  const { b, outside } = fixture(), selection = ids(outside);
  const after = dropped(moveWithMembers(b, selection, -800, 0), selection);
  const restored = exactUndo(b, after);
  const redone = redo(restored.board, restored.history);
  assert.deepEqual(redone.board.objects, after.objects);
});

function interleaved() {
  const { b, section, a, c, outside } = fixture();
  const other = object(b, "section", { x: -900, y: 0 });
  return { ...b, objects: [a, section, outside, other, c].map((o, order) => ({ ...o, order })) };
}
for (const [command, expected] of [
  ["Bring to front", [3, 1, 2, 4, 0]], ["Bring forward", [3, 1, 2, 0, 4]],
  ["Send backward", [1, 3, 0, 2, 4]], ["Send to back", [1, 3, 0, 2, 4]],
]) test(`${command} works within bands for mixed selections and exactly undoes interleaving`, () => {
  const b = interleaved(), selected = ids(b.objects[0], b.objects[1]);
  assert.deepEqual(orderParticipants(b.objects, selected), b.objects.map((o) => o.id));
  const after = { ...b, objects: orderInBands(command, b.objects, selected) };
  assert.deepEqual(after.objects.map((o) => o.id), expected.map((i) => b.objects[i].id));
  const restored = exactUndo(b, after, selected);
  assert.deepEqual(new Set(restored.affectedIds), selected);
  assert.deepEqual(bandOrder(after.objects), after.objects);
  assert.deepEqual(orderParticipants(after.objects, selected), after.objects.filter((o) => selected.has(o.id)).map((o) => o.id));
});

for (const route of ["section", "idea", "Paste", "Duplicate"]) test(`${route} normalizes an interleaved board and Undo restores the exact earlier array`, () => {
  const b = interleaved(); let after;
  if (route === "Paste") after = buildPaste(b, buildSnapshot(b, ids(b.objects[1]), drawn(b)), view).board;
  else if (route === "Duplicate") after = duplicate(b, emptyHistory(), b.objects[1]).board;
  else after = placeObject(b, object(b, route === "idea" ? "text" : "section", { x: 4000 }));
  assert.deepEqual(bandOrder(after.objects), after.objects);
  const beforeSet = new Set(b.objects.map((o) => o.id));
  const oldInResult = after.objects.filter((o) => beforeSet.has(o.id));
  assert.deepEqual(oldInResult.map((o) => o.id), bandOrder(b.objects).map((o) => o.id));
  exactUndo(b, after);
});

test("Delete keeps members in place and clears their links; Undo restores the section and links", () => {
  const { b, section, a, c } = fixture();
  const result = deleteObject(b, emptyHistory(), section);
  assert.equal(result.board.objects.length, b.objects.length - 1);
  assert.deepEqual(result.board.objects.map((o) => o.id), b.objects.filter((o) => o.id !== section.id).map((o) => o.id));
  for (const member of [a, c]) {
    const next = result.board.objects.find((o) => o.id === member.id);
    assert.equal(next.x, member.x); assert.equal(next.y, member.y); assert.equal(next.section, null);
  }
  const restored = undo(result.board, result.history);
  assert.deepEqual(content(restored.board), content(b)); validate(restored.board);
  assert.notEqual(restored.board.objects[0].generation, section.generation);
});

test("Cut's copied set deletes section and members in one step; Undo restores all links", () => {
  const { b, section } = fixture();
  const snapshot = buildSnapshot(b, ids(section), drawn(b));
  assert.equal(snapshot.objects.length, 3);
  const copied = withMembers(b.objects, ids(section));
  const cut = deleteObject(b, emptyHistory(), b.objects.filter((o) => copied.has(o.id)));
  assert.equal(cut.board.objects.length, 1); assert.equal(cut.history.past.length, 1);
  assert.deepEqual(content(undo(cut.board, cut.history).board), content(b));
  const pasted = buildPaste(cut.board, snapshot, view).board;
  const frame = pasted.objects.find((o) => !b.objects.some((old) => old.id === o.id) && o.type === "section");
  assert.equal(pasted.objects.filter((o) => o.section === frame.id).length, 2);
  const pasteHistory = record(cut.history, cut.board, pasted);
  const noPaste = undo(pasted, pasteHistory);
  assert.deepEqual(content(undo(noPaste.board, noPaste.history).board), content(b));
});

for (const route of ["Paste", "Duplicate"]) test(`${route} copies members once, remaps membership and whole groups, clears partial groups and member-only links`, () => {
  let { b, section, a, c } = fixture(); b = groupObjects(b, ids(a, c));
  for (const selected of [ids(section, a), ids(a), ids(a, c)]) {
    const copied = withMembers(b.objects, selected);
    const snapshot = buildSnapshot(b, selected, drawn(b));
    assert.deepEqual(snapshot.objects.map((o) => o.id), b.objects.filter((o) => copied.has(o.id)).map((o) => o.id));
    const after = route === "Paste" ? buildPaste(b, snapshot, view).board
      : duplicate(b, emptyHistory(), b.objects.filter((o) => selected.has(o.id))).board;
    const originals = new Set(b.objects.map((o) => o.id));
    const copies = after.objects.filter((o) => !originals.has(o.id));
    assert.equal(copies.length, copied.size);
    const identifiers = b.objects.flatMap((o) => [o.id, o.generation, o.group]);
    const generated = copies.flatMap((o) => [o.id, o.generation]);
    assert.equal(new Set(generated).size, generated.length);
    assert(generated.every((id) => !identifiers.includes(id)));
    const frame = copies.find((o) => o.type === "section"), ideas = copies.filter((o) => o.type !== "section");
    for (const o of ideas) assert.equal(o.section, frame?.id ?? null);
    if (ideas.length === 1) assert.equal(ideas[0].group, null);
    else { assert(ideas[0].group); assert.equal(ideas[0].group, ideas[1].group); assert(!identifiers.includes(ideas[0].group)); }
    validate(after);
    exactUndo(b, after);
  }
  assert.equal(remapSection(section.id, new Map()), null);
});

test("Section select changes only selected ideas without geometry changes, ignores sections, and does not expand groups", () => {
  let { b, section, a, c, outside } = fixture(); b = groupObjects(b, ids(a, c));
  const result = assignSection(b, ids(section, a, outside), null);
  assert.equal(result.objects.find((o) => o.id === a.id).section, null);
  assert.equal(result.objects.find((o) => o.id === c.id).section, section.id);
  assert.deepEqual(result.objects.map(({ section, ...o }) => o), b.objects.map(({ section, ...o }) => o));
  assert.equal(assignSection(b, ids(a), section.id), b);
  assert.equal(assignSection(b, ids(section), null), b);
  exactUndo(b, result);
});

test("Objects labels use band numbering, group numbers, shortened names and accurate singular/plural counts", () => {
  let { b, section, a, c } = fixture(); b = groupObjects(b, ids(a, c));
  const numbers = groupNumbers(b.objects);
  assert.equal(objectLabel(b, section, numbers), "section 1 · Plan · 2 items");
  assert.equal(objectLabel(b, b.objects[1], numbers), "sticky 1 · Group 1 · Idea · in Plan");
  assert.equal(objectLabel(b, b.objects[2], numbers), "text 2 · Group 1 · Other · in Plan");
  b = assignSection(b, ids(c), null);
  assert.equal(objectLabel(b, section, numbers), "section 1 · Plan · 1 item");
  const third = object(b, "text", { x: 300, y: 300 }); b = placeObject(b, third); b = assignSection(b, ids(c), section.id);
  assert.equal(objectLabel(b, section, numbers), "section 1 · Plan · 3 items");
  const renamed = { ...section, text: "" };
  assert.equal(objectLabel(b, renamed, numbers), "section 1 · Empty · 3 items");
  assert.equal(objectLabel(b, section, numbers, { [section.id]: "A\n" + "b".repeat(40) }), "section 1 · A " + "b".repeat(34) + " · 3 items");
});

test("idea labels keep line breaks while section names show spaces", () => {
  const { b, section, a } = fixture();
  const board = { ...b, objects: b.objects.map((o) => o.id === section.id
    ? { ...o, text: "Plan\nNext" } : o.id === a.id ? { ...o, text: "First\nSecond" } : o) };
  assert.equal(objectLabel(board, board.objects[1], new Map()), "sticky 1 · First\nSecond · in Plan Next");
  assert.equal(objectLabel(board, board.objects[0], new Map()), "section 1 · Plan Next · 2 items");
  assert.equal(objectLabel(board, board.objects[1], new Map(), { [a.id]: "Draft\nText" }),
    "sticky 1 · Draft\nText · in Plan Next");
});

test("drop previews target only sections that dragged ideas would newly join", () => {
  const { b, section, a, c, outside } = fixture();
  const within = moveWithMembers(b, ids(a), 10, 10);
  assert.equal(dropTargets(within, ids(a)).get(a.id), section.id);
  assert.deepEqual(dropTargets(within, ids(a), true), new Map());
  const moving = ids(a, c, outside);
  const mixed = moveWithMembers(b, moving, -400, 0);
  // One idea leaves, one stays, and only the outside idea joins.
  assert.equal(dropTargets(mixed, moving).get(a.id), null);
  assert.equal(dropTargets(mixed, moving).get(c.id), section.id);
  assert.deepEqual(dropTargets(mixed, moving, true), new Map([[outside.id, section.id]]));
});

test("single and set section resizing obeys 200–10,000 and preserves membership", () => {
  const { b, section, a } = fixture(), range = { min: 200, max: 10000 };
  assert.equal(resizeObject("se", section, { x: 20000, y: 20000 }, false, () => 0, range).width, 10000);
  const small = resizeObject("se", section, { x: -20000, y: -20000 }, false, () => 0, range);
  assert.equal(small.width, 200); assert.equal(small.height, 200);
  const members = [section, a].map((o) => ({ ...o, sizeRange: o.type === "section" ? range : { min: 40, max: 2000 }, neededHeight: () => 0 }));
  for (const delta of [-100000, 100000]) {
    const resized = resizeSet("se", members, { x: delta, y: delta }, false);
    resized.forEach((o, i) => { assert(o.width >= members[i].sizeRange.min && o.width <= members[i].sizeRange.max); assert(o.height >= members[i].sizeRange.min && o.height <= members[i].sizeRange.max); });
    const changed = { ...b, objects: b.objects.map((o) => o.id === section.id ? { ...o, ...resized[0] } : o) };
    assert.deepEqual(changed.objects.map((o) => o.section), b.objects.map((o) => o.section)); validate(changed);
  }
});
