// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { buildPaste, buildSnapshot, clipboardReason, plainText } from "../apps/web/src/clipboard.ts";
import { add, empty, validate } from "../apps/web/src/document.ts";
import { groupObjects } from "../apps/web/src/group.ts";
import { deleteObject, emptyHistory, record, undo, redo } from "../apps/web/src/history.ts";

const editable = { readOnly: false, composing: false, pointerGesture: false, invalidObjectText: false };
const view = { centerX: 0, centerY: 0, zoom: 1, width: 4000, height: 4000 };
function board(count = 4) {
  let b = { ...empty(), title: "Synthetic clipboard" };
  for (let i = 0; i < count; i++) b = add(b, i % 2 ? "text" : "sticky", i * 300, 0);
  return { ...b, objects: b.objects.map((o, i) => ({ ...o, text: `Committed ${i + 1}` })) };
}
const ids = (b, ...indexes) => new Set(indexes.map((i) => b.objects[i].id));
const drawn = (b) => b.objects.map((o) => ({ ...o, displayHeight: o.height }));
const snapshot = (b, selection = new Set(b.objects.map((o) => o.id)), rectangles = drawn(b)) =>
  buildSnapshot(b, selection, rectangles);
const identifiers = (b) => [...new Set([b.boardId, ...b.retiredGenerations,
  ...b.objects.flatMap((o) => [o.id, o.generation, ...(o.group ? [o.group] : [])])])];

test("snapshot stores committed content in reading order, whole group marks, drawn edges and source identifiers", () => {
  let b = board(6);
  b = groupObjects(b, ids(b, 0, 2));
  b = groupObjects(b, ids(b, 1, 3));
  // Leave a group with a single member; it is still a whole group when copied.
  b = { ...b, objects: b.objects.filter((o) => o.order !== 3).map((o, order) => ({ ...o, order })) };
  b = groupObjects(b, ids(b, 3, 4));
  const before = structuredClone(b), selection = ids(b, 4, 2, 1, 0);
  const rectangles = drawn(b).map((o, i) => ({ ...o, text: "Uncommitted draft", displayHeight: o.height + 700 + i }));
  const s = snapshot({ ...b, objects: [...b.objects].reverse() }, selection, rectangles);
  const copied = b.objects.filter((o) => selection.has(o.id));
  assert.deepEqual(s.objects, copied.map(({ generation, order, ...o }) => ({
    ...o, group: order === 4 ? null : o.group,
  })));
  assert.deepEqual(s.objects.map((o) => o.text), copied.map((o) => o.text));
  assert.deepEqual(s.objects.map((o) => o.group), [b.objects[0].group, b.objects[1].group, b.objects[2].group, null]);
  const selectedDrawn = rectangles.filter((o) => selection.has(o.id));
  assert.deepEqual(s.sourceBox, {
    left: Math.min(...selectedDrawn.map((o) => o.x)),
    top: Math.min(...selectedDrawn.map((o) => o.y)),
    right: Math.max(...selectedDrawn.map((o) => o.x + o.width)),
    bottom: Math.max(...selectedDrawn.map((o) => o.y + o.displayHeight)),
  });
  assert(s.sourceBox.bottom > Math.max(...copied.map((o) => o.y + o.height)));
  assert.deepEqual(new Set(s.sourceIdentifiers), new Set([
    ...copied.flatMap((o) => [o.id, o.generation]), b.objects[0].group, b.objects[1].group,
  ]));
  assert.equal(s.pasteCount, 0);
  assert.deepEqual(b, before);
  // The snapshot owns its content and does not follow later board edits.
  b.objects[0].text = "Later edit";
  assert.equal(s.objects[0].text, before.objects[0].text);
  assert.equal(snapshot(b, new Set()), null);
});

test("plain text preserves snapshot order, skips only empty strings, and permits all empty", () => {
  const b = board(), s = snapshot(b);
  s.objects.forEach((o, i) => { o.text = ["First\nline", "", " ", "Last"][i]; });
  assert.equal(plainText(s), "First\nline\n\n \n\nLast");
  s.objects.forEach((o) => { o.text = ""; });
  assert.equal(plainText(s), "");
});

test("paste assigns globally fresh identifiers, maps each whole group once, copies exact content and appends in order", () => {
  let b = board(6);
  b = groupObjects(b, ids(b, 0, 2));
  b = groupObjects(b, ids(b, 1, 3));
  b = groupObjects(b, ids(b, 4, 5));
  b.objects[0] = { ...b.objects[0], color: "blue", textSize: "large", align: "right" };
  b.retiredGenerations = [crypto.randomUUID()];
  const before = structuredClone(b), s = snapshot(b, ids(b, 4, 3, 2, 1, 0)), saved = structuredClone(s);
  const first = buildPaste(b, s, view), copies = first.board.objects.slice(b.objects.length);
  validate(first.board);
  assert.deepEqual(first.board.objects.slice(0, b.objects.length), b.objects);
  for (const [i, o] of copies.entries()) {
    const { id, generation, order, x, y, group, ...content } = o;
    const { id: sourceId, x: sx, y: sy, group: mark, ...expected } = s.objects[i];
    assert.deepEqual(content, expected);
    assert.equal(order, b.objects.length + i);
    assert.equal(x, sx + 24);
    assert.equal(y, sy + 24);
    assert.equal(group === null, mark === null);
  }
  assert.equal(copies[0].group, copies[2].group);
  assert.equal(copies[1].group, copies[3].group);
  assert.notEqual(copies[0].group, copies[1].group);
  const created = [...copies.flatMap((o) => [o.id, o.generation]), ...new Set(copies.map((o) => o.group).filter(Boolean))];
  assert.equal(new Set(created).size, created.length);
  for (const id of created) assert(!identifiers(b).includes(id));
  const second = buildPaste(first.board, { ...s, pasteCount: first.pasteCount }, view);
  const nextCopies = second.board.objects.slice(first.board.objects.length);
  for (const o of nextCopies) for (const id of [o.id, o.generation, o.group].filter(Boolean)) {
    assert(!identifiers(first.board).includes(id));
    assert(!s.sourceIdentifiers.includes(id));
  }
  assert.deepEqual(s, saved);
  assert.deepEqual(b, before);
  validate(second.board);
});

test("after Cut, a UUID source offering source and existing identifiers cannot reuse them or a newly generated identifier", (t) => {
  let b = board(3);
  b = groupObjects(b, ids(b, 0, 1));
  const s = snapshot(b, ids(b, 0, 1));
  const cut = deleteObject(b, emptyHistory(), b.objects.slice(0, 2));
  const fresh = crypto.randomUUID(), another = crypto.randomUUID();
  const offers = [...s.sourceIdentifiers, ...identifiers(cut.board), fresh, fresh, another, another];
  const randomUUID = crypto.randomUUID.bind(crypto);
  t.mock.method(crypto, "randomUUID", () => offers.shift() ?? randomUUID());
  const result = buildPaste(cut.board, s, view);
  const copies = result.board.objects.slice(cut.board.objects.length);
  const created = [copies[0].group, ...copies.flatMap((o) => [o.id, o.generation])];
  assert.equal(new Set(created).size, 5);
  for (const id of created) assert(!s.sourceIdentifiers.includes(id) && !identifiers(cut.board).includes(id));
  assert.equal(offers.length, 0);
  validate(result.board);
});

test("the first three pastes cascade by 24, 48 and 72 from the fixed source box", () => {
  let b = board(2), s = snapshot(b);
  for (let n = 1; n <= 3; n++) {
    const result = buildPaste(b, s, view);
    assert.equal(result.pasteCount, n);
    const copies = result.board.objects.slice(b.objects.length);
    copies.forEach((o, i) => {
      assert.equal(o.x, s.objects[i].x + 24 * n);
      assert.equal(o.y, s.objects[i].y + 24 * n);
    });
    b = result.board;
    s = { ...s, pasteCount: result.pasteCount };
  }
});

for (const edge of ["left", "right", "top", "bottom"]) {
  test(`stored source ${edge} touching the view edge is in view at non-unit zoom`, () => {
    const b = board(1), s = snapshot(b), box = s.sourceBox;
    const v = { ...view, zoom: 2, width: 1000, height: 1000 };
    if (edge === "left") v.centerX = box.left + v.width / (2 * v.zoom);
    if (edge === "right") v.centerX = box.right - v.width / (2 * v.zoom);
    if (edge === "top") v.centerY = box.top + v.height / (2 * v.zoom);
    if (edge === "bottom") v.centerY = box.bottom - v.height / (2 * v.zoom);
    const o = buildPaste(b, s, v).board.objects.at(-1);
    assert.equal(o.x, b.objects[0].x + 24);
    assert.equal(o.y, b.objects[0].y + 24);
  });
  test(`source partly outside the view's ${edge} edge centres with the stored four edges`, () => {
    const b = board(2), s = snapshot(b), box = s.sourceBox;
    const v = { ...view };
    if (edge === "left") v.centerX = box.left + 1 + v.width / 2;
    if (edge === "right") v.centerX = box.right - 1 - v.width / 2;
    if (edge === "top") v.centerY = box.top + 1 + v.height / 2;
    if (edge === "bottom") v.centerY = box.bottom - 1 - v.height / 2;
    const result = buildPaste(b, { ...s, pasteCount: 8 }, v);
    result.board.objects.slice(b.objects.length).forEach((o, i) => {
      assert.equal(o.x, s.objects[i].x + (v.centerX - (box.left + box.right) / 2));
      assert.equal(o.y, s.objects[i].y + (v.centerY - (box.top + box.bottom) / 2));
    });
    assert.equal(result.pasteCount, 9);
  });
}

test("pan-away centring uses the drawn bottom, including taller display heights", () => {
  const b = board(2), rectangles = drawn(b);
  rectangles[1].displayHeight = 1000;
  const s = snapshot(b, new Set(b.objects.map((o) => o.id)), rectangles);
  const v = { ...view, centerX: 50000.1, centerY: -60000.2 };
  buildPaste(b, s, v).board.objects.slice(b.objects.length).forEach((o, i) => {
    assert.equal(o.x, s.objects[i].x + (v.centerX - (s.sourceBox.left + s.sourceBox.right) / 2));
    assert.equal(o.y, s.objects[i].y + (v.centerY - (s.sourceBox.top + s.sourceBox.bottom) / 2));
    assert.equal(o.height, s.objects[i].height);
  });
});

test("in-view classification uses stored right, never left plus reconstructed width", () => {
  const b = board(2);
  b.objects[0] = { ...b.objects[0], x: -1000, y: 0, width: 80.1 };
  b.objects[1] = { ...b.objects[1], x: 0, y: 0, width: 80.1 };
  const s = snapshot(b), { left, right } = s.sourceBox;
  assert.notEqual(right, left + (right - left));
  // This computed view edge lies between the reconstructed and stored right.
  const v = { ...view, centerX: -512, width: 1184.1999999999998 };
  const viewRight = v.centerX + v.width / (2 * v.zoom);
  assert(left + (right - left) <= viewRight && viewRight < right);
  const o = buildPaste(b, s, v).board.objects[b.objects.length];
  assert.equal(o.x, b.objects[0].x + (v.centerX - (left + right) / 2));
  assert.notEqual(o.x, b.objects[0].x + 24);
});

for (const [axis, centre, length] of [["x", -1e6, "width"], ["x", 1e6, "width"],
  ["y", -1e6, "height"], ["y", 1e6, "height"]]) {
  test(`paste clamps ${axis} at ${centre} using saved dimensions`, () => {
    const b = board(2);
    b.objects[1] = { ...b.objects[1], x: 1000, y: 1000 };
    const s = snapshot(b), v = { ...view, [axis === "x" ? "centerX" : "centerY"]: centre };
    const copies = buildPaste(b, s, v).board.objects.slice(b.objects.length);
    for (const o of copies) {
      assert(o[axis] >= -1e6);
      assert(o[axis] + o[length] <= 1e6);
    }
    assert(copies.some((o) => centre < 0 ? o[axis] === -1e6 : o[axis] === 1e6 - o[length]));
  });
}

test("fractional right and bottom rounding stays within the board using saved height, not display height", () => {
  const b = board(1);
  b.objects[0] = { ...b.objects[0], x: 999919.9, y: 999919.9, width: 80.1, height: 80.1 };
  const s = snapshot(b, ids(b, 0), [{ ...b.objects[0], displayHeight: 80.1000000001 }]);
  const result = buildPaste(b, s, { ...view, centerX: 1e6, centerY: 1e6 });
  const o = result.board.objects.at(-1);
  assert(o.x + o.width <= 1e6 && o.y + o.height <= 1e6);
  assert.equal(o.x, 1e6 - 80.1);
  assert.equal(o.y, 1e6 - 80.1);
  assert.equal(o.height, 80.1);
  validate(result.board);
});

test("a refused paste above 250 changes neither board nor count; exactly 250 succeeds", () => {
  const b = board(249), s = snapshot(b, ids(b, 0, 1));
  s.pasteCount = 3;
  const before = structuredClone(b), saved = structuredClone(s);
  assert.throws(() => buildPaste(b, s, view), /250 object limit reached/);
  assert.deepEqual(b, before);
  assert.deepEqual(s, saved);
  const single = snapshot(b, ids(b, 0));
  assert.equal(buildPaste(b, single, view).board.objects.length, 250);
});

test("availability reasons follow v14 order, allowing Copy in read-only views", () => {
  const b = board(1), s = snapshot(b), selected = ids(b, 0), none = new Set();
  const conditions = [
    ["readOnly", "Read-only: editing commands are unavailable."],
    ["composing", "Finish text composition before using editing commands."],
    ["pointerGesture", "Finish or cancel the pointer gesture before using editing commands."],
    ["invalidObjectText", "Correct invalid drafts before using editing commands."],
  ];
  for (const name of ["Copy", "Cut", "Paste"]) {
    const applicable = name === "Copy" ? conditions.slice(1) : conditions;
    for (let i = 0; i < applicable.length; i++) {
      const state = { ...editable, ...Object.fromEntries(applicable.slice(i).map(([key]) => [key, true])) };
      if (name === "Copy") state.readOnly = true;
      for (const selection of [none, selected]) for (const clipboard of [null, s]) {
        assert.equal(clipboardReason(name, selection, clipboard, state), applicable[i][1]);
      }
    }
    assert.equal(clipboardReason(name, selected, s, editable), "");
  }
  assert.equal(clipboardReason("Copy", selected, null, { ...editable, readOnly: true }), "");
  assert.equal(clipboardReason("Copy", none, s, { ...editable, readOnly: true }), "Select an object to copy.");
  assert.equal(clipboardReason("Cut", none, s, editable), "Select an object to cut.");
  assert.equal(clipboardReason("Paste", selected, null, editable), "Nothing to paste.");
  assert.equal(clipboardReason("Paste", none, s, editable), "");
});

test("one history step removes a whole paste; one restores a Cut with its group and order", () => {
  let b = board(3);
  b = groupObjects(b, ids(b, 0, 2));
  const s = snapshot(b, ids(b, 0, 2)), pasted = buildPaste(b, s, view).board;
  const h = record(emptyHistory(), b, pasted);
  assert.equal(h.past.length, 1);
  const removed = undo(pasted, h);
  assert.deepEqual(removed.board.objects, b.objects);
  for (const o of pasted.objects.slice(b.objects.length)) assert(removed.board.retiredGenerations.includes(o.generation));
  const restoredPaste = redo(removed.board, removed.history).board;
  assert.deepEqual(restoredPaste.objects.map((o) => o.group), pasted.objects.map((o) => o.group));
  const cut = deleteObject(b, emptyHistory(), b.objects.filter((o) => s.sourceIdentifiers.includes(o.id)));
  assert.equal(cut.history.past.length, 1);
  const restoredCut = undo(cut.board, cut.history).board;
  for (const [i, o] of restoredCut.objects.entries()) {
    assert.deepEqual({ ...o, generation: b.objects[i].generation }, b.objects[i]);
    if (s.sourceIdentifiers.includes(o.id)) assert.notEqual(o.generation, b.objects[i].generation);
  }
  validate(restoredPaste);
  validate(restoredCut);
});

test("copy and paste retain owned marks while the system clipboard remains plain text", () => {
  const b = board(2);
  b.objects[0].marks = [{ start: 0, end: 3, bold: true, italic: true }];
  b.objects[1].marks = [{ start: 2, end: 5, strike: true }];
  const before = structuredClone(b), s = snapshot(b);
  assert.deepEqual(s.objects.map((o) => o.marks), b.objects.map((o) => o.marks));
  assert.equal(plainText(s), b.objects.map((o) => o.text).join("\n\n"));
  b.objects[0].marks[0].end = 2;
  assert.deepEqual(s.objects[0].marks, before.objects[0].marks);
  const pasted = buildPaste(before, s, view).board;
  assert.deepEqual(pasted.objects.slice(2).map((o) => o.marks), before.objects.map((o) => o.marks));
  assert.deepEqual(pasted.objects.slice(2).map((o) => o.text), before.objects.map((o) => o.text));
  validate(pasted);
});
