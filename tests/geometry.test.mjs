// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { allowedHeight, displayHeight, neededHeight, savedHeight } from "../apps/web/src/geometry.ts";
import { add, canonical, empty, validate } from "../packages/board-rules/src/document.ts";
import { Adapter } from "../apps/web/src/document-adapter.ts";
import { emptyHistory, record, redo, undo } from "../apps/web/src/history.ts";

function rectangularBoard() {
  const board = add({ ...empty(), title: "Synthetic geometry board" }, "sticky", 0, 0);
  board.objects[0].height = 160;
  return board;
}

test("new stickies are square; text dimensions and centering stay unchanged", () => {
  for (const [type, width, height] of [["sticky", 240, 240], ["text", 320, 120]]) {
    const board = add({ ...empty(), title: "Default sizes" }, type, 0, 0);
    const object = board.objects[0];
    assert.deepEqual([object.width, object.height, object.x, object.y],
      [width, height, -width / 2, -height / 2]);
    validate(board);
  }
});

test("needed height includes one empty line, line height and both insets", () => {
  assert.equal(neededHeight(0), 67);
  assert.equal(neededHeight(1), 67);
  assert.equal(neededHeight(5), 171);
  assert.equal(neededHeight(10), 301);
  assert.equal(neededHeight(100), 2650);
});

test("saved height grows only when needed; deleting text never shrinks it", () => {
  const object = Object.freeze(rectangularBoard().objects[0]);
  assert.equal(savedHeight(object, 1), 160);
  assert.equal(savedHeight(object, 4), 160);
  assert.equal(savedHeight(object, 5), 171);
  const grown = { ...object, height: savedHeight(object, 10) };
  assert.equal(grown.height, 301);
  assert.equal(savedHeight(grown, 1), 301);
  assert.equal(object.height, 160);
});

test("saved and display heights stop at 2,000 units", () => {
  const object = rectangularBoard().objects[0];
  assert.equal(allowedHeight(object.y), 2000);
  assert.equal(savedHeight(object, 75), 1998);
  assert.equal(savedHeight(object, 76), 2000);
  assert.equal(savedHeight(object, 1000), 2000);
  assert.equal(displayHeight(object, 1000), 2000);
});

test("bottom-edge fade case needs 171 but displays and saves at 160 without moving", () => {
  const board = rectangularBoard();
  const object = board.objects[0] = { ...board.objects[0], y: 999840 };
  const before = structuredClone(object);
  assert.equal(allowedHeight(object.y), 160);
  assert.equal(neededHeight(5), 171);
  assert.equal(displayHeight(object, 5), 160);
  assert.equal(savedHeight(object, 5), 160);
  assert(neededHeight(5) > allowedHeight(object.y));
  for (const lines of [0, 1, 4, 5, 1000]) {
    const next = { ...object, height: savedHeight(object, lines) };
    validate({ ...board, objects: [next] });
    assert.equal(next.y + next.height, 1000000);
    assert.deepEqual(next, before);
  }
});

test("every capped result validates and retains width, position and identity", () => {
  const board = rectangularBoard();
  for (const y of [-1000000, 0, 998000, 999840, 999960]) {
    const object = { ...board.objects[0], y, height: Math.min(160, allowedHeight(y)) };
    for (const lines of [0, 1, 4, 5, 75, 76, 1000]) {
      for (const height of [savedHeight(object, lines), displayHeight(object, lines)]) {
        const result = { ...object, height };
        validate({ ...board, objects: [result] });
        assert.equal(result.width, object.width);
        assert.equal(result.x, object.x);
        assert.equal(result.y, object.y);
        assert.equal(result.id, object.id);
        assert.equal(result.generation, object.generation);
        assert(height >= object.height && height <= allowedHeight(y));
      }
    }
  }
});

test("existing rectangular objects reopen unchanged; display-only growth is never saved", () => {
  const board = rectangularBoard();
  board.objects[0].text = "One\nTwo\nThree\nFour\nFive";
  const payload = canonical(board);
  const reopened = validate(JSON.parse(payload));
  const object = reopened.objects[0];
  assert.equal(object.width, 240);
  assert.equal(object.height, 160);
  assert.equal(displayHeight(object, 5), 171);
  assert.equal(displayHeight(object, 1), 160);
  assert.equal(displayHeight(object, 1000), 2000);
  assert.equal(canonical(reopened), payload);
  assert.equal(object.height, 160);
});

test("text and height share one adapter transaction and one editing-session undo step", () => {
  const before = add(rectangularBoard(), "text", 500, 500);
  const original = before.objects[0];
  const adapter = new Adapter();
  adapter.set(before);
  let revisions = 0;
  adapter.doc.on("afterTransaction", () => revisions++);
  const text = "One\nTwo\nThree\nFour\nFive";
  const after = {
    ...before,
    objects: [{ ...original, text, height: savedHeight(original, 5) }, before.objects[1]],
  };
  adapter.set(after);
  assert.equal(revisions, 1);
  const stored = adapter.doc.getMap("objects").get(original.id);
  assert.equal(stored.get("text").toString(), text);
  assert.equal(stored.get("geometry").height, 171);
  const history = record(emptyHistory(), before, after);
  assert.equal(history.past.length, 1);
  const reverted = undo(after, history);
  assert.deepEqual(reverted.board, before);
  const reapplied = redo(reverted.board, reverted.history);
  assert.deepEqual(reapplied.board, after);
  assert.deepEqual(validate(JSON.parse(canonical(after))), after);
  assert.deepEqual(after.objects[1], before.objects[1]);
  adapter.destroy();
});

test("a session returning to its original text still undoes retained height growth", () => {
  const before = rectangularBoard();
  const original = before.objects[0];
  const after = { ...before, objects: [{ ...original, height: savedHeight(original, 10) }] };
  const history = record(emptyHistory(), before, after);
  assert.equal(history.past.length, 1);
  assert.equal(after.objects[0].text, original.text);
  assert.deepEqual(undo(after, history).board, before);
});

test("needed height uses each declared text size, including an empty line", () => {
  for (const size of [14, 18, 24, 32]) {
    for (const lines of [0, 1, 5, 100]) {
      assert.equal(neededHeight(lines, size), Math.ceil(Math.max(1, lines) * size * 1.45) + 40);
    }
  }
});
test("size growth keeps width and position, caps at both limits, and never shrinks", () => {
  const original = rectangularBoard().objects[0];
  for (const y of [0, 999840, 999960]) {
    const object = { ...original, y, height: Math.min(original.height, allowedHeight(y)) };
    for (const size of [14, 18, 24, 32]) {
      for (const lines of [1, 5, 100]) {
        const height = savedHeight(object, lines, size);
        assert.equal(height, Math.min(allowedHeight(y), Math.max(object.height, neededHeight(lines, size))));
        assert.equal(displayHeight(object, lines, size), height);
        assert(height >= object.height && height <= allowedHeight(y));
        const smaller = { ...object, height };
        assert.equal(savedHeight(smaller, lines, 14), height);
      }
    }
  }
  assert.equal(savedHeight(original, 5, 32), 272);
  assert.equal(savedHeight({ ...original, height: 272 }, 5, 14), 272);
});
