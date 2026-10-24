// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { ARRANGE_GROUPS, arrangeOrder, arrangePositions, arrangeReason } from "../apps/web/src/arrange.ts";

const editing = { readOnly: false, composing: false, pointerGesture: false, invalidObjectText: false };
const object = (id, order, x, y, width = 80, displayHeight = 40) =>
  ({ id, order, x, y, width, height: 40, displayHeight });
const members = [object("a", 0, -30, -80, 80, 180), object("b", 1, 180, 200, 120, 60),
  object("c", 2, 480, 400, 160, 100)];
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const unchangedAxisAndInput = (before, after, horizontal) => {
  for (const p of after) {
    const original = before.find((o) => o.id === p.id);
    assert.equal(p[horizontal ? "y" : "x"], original[horizontal ? "y" : "x"]);
    assert.deepEqual(Object.keys(p).sort(), ["id", "x", "y"]);
  }
};
for (const count of [2, 3]) {
  for (const name of ARRANGE_GROUPS[0].commands) {
    test(`${name} uses drawn bounds for ${count} objects and leaves sizes unchanged`, () => {
      const input = structuredClone(members.slice(0, count));
      const before = structuredClone(input);
      const left = -30, top = -80;
      const right = count === 2 ? 300 : 640, bottom = count === 2 ? 260 : 500;
      const result = arrangePositions(name, input);
      const horizontal = /left|centre|right/.test(name);
      for (const p of result) {
        const o = input.find((o) => o.id === p.id);
        const expected = name.endsWith("left") ? left : name.endsWith("centre") ? left + (right - left - o.width) / 2
          : name.endsWith("right") ? right - o.width : name.endsWith("top") ? top
          : name.endsWith("middle") ? top + (bottom - top - o.displayHeight) / 2 : bottom - o.displayHeight;
        assert.equal(p[horizontal ? "x" : "y"], expected);
      }
      unchangedAxisAndInput(input, result, horizontal);
      assert.deepEqual(input, before);
    });
  }
}

for (const horizontal of [true, false]) {
  const name = horizontal ? "Distribute horizontally" : "Distribute vertically";
  const positions = (objects) => arrangePositions(name, objects).map((o) => o[horizontal ? "x" : "y"]);
  const sized = (id, order, position, length) => horizontal
    ? object(id, order, position, 17, length) : object(id, order, 17, position, 80, length);
  test(`${name} keeps outer edges and equal gaps with different drawn sizes`, () => {
    const input = [sized("a", 0, 0, 80), sized("b", 1, 100, 120), sized("c", 2, 500, 100)];
    const before = structuredClone(input);
    const result = arrangePositions(name, input);
    assert.deepEqual(positions(input), [0, 230, 500]);
    unchangedAxisAndInput(input, result, horizontal);
    assert.deepEqual(input, before);
  });
  test(`${name} breaks position ties by order, regardless of input sequence`, () => {
    const input = [sized("b", 1, 0, 90), sized("a", 0, 0, 80), sized("c", 2, 400, 100)];
    assert.deepEqual(positions(input), [195, 0, 400]);
  });
  test(`${name} permits zero free space and rejects negative space`, () => {
    const input = [sized("a", 0, 0, 80), sized("b", 1, 10, 80), sized("c", 2, 160, 80)];
    assert.equal(arrangeReason(name, input, editing), "");
    assert.deepEqual(positions(input), [0, 80, 160]);
    input[2][horizontal ? "x" : "y"] = 159;
    assert.equal(arrangeReason(name, input, editing), horizontal
      ? "The objects don't fit side by side to distribute."
      : "The objects don't fit one above another to distribute.");
    assert.deepEqual(positions(input), input.map((o) => o[horizontal ? "x" : "y"]));
  });
  test(`${name} accumulates fractional lengths one at a time in sorted order`, () => {
    const input = [sized("c", 2, 160.2, 80.1), sized("a", 0, 0, 80), sized("b", 1, 80, 80.2)];
    assert.equal(arrangeReason(name, input, editing), "");
    assert.deepEqual(positions(input), [160.2, 0, 80]);
  });
  test(`${name} clamps floating-point overflow at the board edge to the nearest double`, () => {
    const input = [999001, 999300, 999600, 999920].map((p, i) => sized(String(i), i, p, 80));
    const result = positions(input);
    assert.equal(result[0], 999001);
    assert.ok(result.every((p) => p >= 999001 && p + 80 <= 1e6));
    assert.equal(result.at(-1), 999920);
    near(result[1] - result[0] - 80, result[2] - result[1] - 80);
    near(result[2] - result[1] - 80, result[3] - result[2] - 80);
  });
}

function nextUp(n) {
  if (n === 0) return Number.MIN_VALUE;
  const bits = new DataView(new ArrayBuffer(8));
  bits.setFloat64(0, n);
  bits.setBigUint64(0, bits.getBigUint64(0) + (n > 0 ? 1n : -1n));
  return bits.getFloat64(0);
}
for (const name of ["Align objects right", "Align objects centre", "Align objects bottom", "Align objects middle"]) {
  test(`${name} stays inside the measured box at the board edge`, () => {
    const horizontal = name.endsWith("right") || name.endsWith("centre");
    const input = horizontal
      ? [object("a", 0, 999919.7, 0, 80.3), object("b", 1, 999919.8, 0, 80.2)]
      : [object("a", 0, 0, 999919.7, 80, 80.3), object("b", 1, 0, 999919.8, 80, 80.2)];
    const result = arrangePositions(name, input);
    for (const [i, p] of result.entries()) {
      const position = horizontal ? p.x : p.y, length = horizontal ? input[i].width : input[i].displayHeight;
      assert.ok(position >= 999919.7);
      assert.ok(position + length <= 1e6);
    }
  });
}
test("bottom alignment with a much taller display height corrects cancellation to the nearest double", () => {
  const input = [object("tall", 0, 0, -1000, 80, 1006), object("edge", 1, 0, 60.1, 80, 40)];
  const bottom = 60.1 + 40;
  const result = arrangePositions("Align objects bottom", input);
  assert.ok(result[0].y + 1006 <= bottom);
  assert.ok(nextUp(result[0].y) + 1006 > bottom);
  assert.equal(result[1].y, bottom - 40);
  assert.equal(input[0].height, 40);
});

const ordered = Array.from("abcdef", (id, order) => ({ id, order, x: order * 10 }));
const cases = [
  ["Bring to front", ["b"], "acdefb"], ["Bring forward", ["b"], "acbdef"],
  ["Send backward", ["e"], "abcedf"], ["Send to back", ["e"], "eabcdf"],
  ["Bring to front", ["b", "d"], "acefbd"], ["Bring forward", ["b", "d"], "acbedf"],
  ["Send backward", ["b", "d"], "badcef"], ["Send to back", ["b", "d"], "bdacef"],
  ["Bring forward", ["d", "e"], "abcfde"], ["Send backward", ["b", "c"], "bcadef"],
  ["Bring forward", ["b", "f"], "acbdef"], ["Send backward", ["a", "e"], "abcedf"],
  ["Bring to front", ["f"], "abcdef"], ["Bring forward", ["f"], "abcdef"],
  ["Send to back", ["a"], "abcdef"], ["Send backward", ["a"], "abcdef"],
  ["Bring to front", ["e", "f"], "abcdef"], ["Bring forward", ["e", "f"], "abcdef"],
  ["Send to back", ["a", "b"], "abcdef"], ["Send backward", ["a", "b"], "abcdef"],
];
for (const [name, selection, expected] of cases) {
  test(`${name} on ${selection} gives ${expected} without changing geometry or input`, () => {
    const before = structuredClone(ordered);
    const result = arrangeOrder(name, ordered, new Set(selection));
    assert.equal(result.map((o) => o.id).join(""), expected);
    assert.deepEqual(result.map((o) => o.order), [0, 1, 2, 3, 4, 5]);
    for (const o of result) assert.equal(o.x, before.find((v) => v.id === o.id).x);
    assert.deepEqual(ordered, before);
    assert.deepEqual(result.filter((o) => selection.includes(o.id)).map((o) => o.id),
      before.filter((o) => selection.includes(o.id)).map((o) => o.id));
  });
}
test("order commands do nothing with all or no objects selected", () => {
  for (const name of ARRANGE_GROUPS[2].commands) {
    assert.deepEqual(arrangeOrder(name, ordered, new Set()), ordered);
    assert.deepEqual(arrangeOrder(name, ordered, new Set(ordered.map((o) => o.id))), ordered);
    assert.deepEqual(arrangeOrder(name, [], new Set()), []);
  }
});

test("availability follows editing-state precedence before counts and fit", () => {
  const conditions = [
    ["readOnly", "Read-only: editing commands are unavailable."],
    ["composing", "Finish text composition before using editing commands."],
    ["pointerGesture", "Finish or cancel the pointer gesture before using editing commands."],
    ["invalidObjectText", "Correct invalid drafts before using editing commands."],
  ];
  for (const group of ARRANGE_GROUPS) for (const name of group.commands) {
    for (let i = 0; i < conditions.length; i++) {
      const state = { ...editing, ...Object.fromEntries(conditions.slice(i).map(([key]) => [key, true])) };
      assert.equal(arrangeReason(name, [], state), conditions[i][1]);
    }
  }
  for (const name of ARRANGE_GROUPS[0].commands) {
    for (const count of [0, 1]) assert.equal(arrangeReason(name, members.slice(0, count), editing), "Select two or more objects to align.");
    assert.equal(arrangeReason(name, members.slice(0, 2), editing), "");
  }
  for (const name of ARRANGE_GROUPS[1].commands) {
    for (const count of [0, 1, 2]) assert.equal(arrangeReason(name, members.slice(0, count), editing), "Select three or more objects to distribute.");
  }
  for (const name of ARRANGE_GROUPS[2].commands) {
    assert.equal(arrangeReason(name, [], editing), "Select an object to duplicate or delete.");
    assert.equal(arrangeReason(name, members.slice(0, 1), editing), "");
  }
});


test("distribution near zero chooses the nearest valid double, not just edge minus width", () => {
  const input = [object("a", 0, -200, 0, 80), object("b", 1, -100, 0, 80.2), object("c", 2, 0, 0, 80.1)];
  const x = arrangePositions("Distribute horizontally", input)[2].x;
  assert.ok(x > 0);
  assert.ok(x + 80.1 <= 80.1);
  assert.ok(nextUp(x) + 80.1 > 80.1);
});
