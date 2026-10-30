// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { cornerPoint, resizeObject, resizeSet } from "../apps/web/src/resize.ts";
import { add, empty, validate } from "../packages/board-rules/src/document.ts";
import { Adapter } from "../apps/web/src/document-adapter.ts";
import { emptyHistory, record, redo, undo } from "../apps/web/src/history.ts";

const start = { x: 100, y: 200, width: 200, height: 100 };
const floor = () => 40;
const member = (rectangle, neededHeight = floor) => ({ ...rectangle, neededHeight });
const geometry = ({ x, y, width, height }) => ({ x, y, width, height });
const single = (corner, delta, rectangle = start, shift = false, text = floor) =>
  resizeObject(corner, rectangle, delta, shift, text);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const closeGeometry = (actual, expected) => {
  for (const key of ["x", "y", "width", "height"]) close(actual[key], expected[key]);
};
const corners = ["nw", "ne", "sw", "se"];

for (const corner of corners) {
  const left = corner.endsWith("w"), top = corner.startsWith("n");
  test(`single ${corner} keeps its opposite corner fixed`, () => {
    const result = single(corner, { x: left ? -50 : 50, y: top ? -25 : 25 });
    assert.deepEqual(result, { x: left ? 50 : 100, y: top ? 175 : 200, width: 250, height: 125 });
    assert.equal(result.x + (left ? result.width : 0), start.x + (left ? start.width : 0));
    assert.equal(result.y + (top ? result.height : 0), start.y + (top ? start.height : 0));
  });
  test(`single ${corner} stops at size minima and maxima`, () => {
    assert.deepEqual(single(corner, { x: left ? 1e4 : -1e4, y: top ? 1e4 : -1e4 }), {
      x: left ? 220 : 100, y: top ? 260 : 200, width: 80, height: 40,
    });
    assert.deepEqual(single(corner, { x: left ? -1e4 : 1e4, y: top ? -1e4 : 1e4 }), {
      x: left ? -1700 : 100, y: top ? -1700 : 200, width: 2000, height: 2000,
    });
    const narrow = { ...start, width: 50 };
    assert.equal(single(corner, { x: left ? 100 : -100, y: 0 }, narrow).width, 50);
  });
}

test("single each board edge stops expansion", () => {
  for (const [corner, rectangle, delta, expected] of [
    ["nw", { ...start, x: -999990 }, { x: -100, y: 0 }, { ...start, x: -1e6, width: 210 }],
    ["se", { ...start, x: 999790 }, { x: 100, y: 0 }, { ...start, x: 999790, width: 210 }],
    ["ne", { ...start, y: -999990 }, { x: 0, y: -100 }, { ...start, y: -1e6, height: 110 }],
    ["sw", { ...start, y: 999890 }, { x: 0, y: 100 }, { ...start, y: 999890, height: 110 }],
  ]) assert.deepEqual(single(corner, delta, rectangle), expected);
});

test("single text floor uses new width after size limits, growing with the top fixed", () => {
  const widths = [];
  const result = single("se", { x: -500, y: -100 }, start, false,
    (width) => { widths.push(width); return width < 100 ? 300 : 40; });
  assert.deepEqual(widths, [80]);
  assert.deepEqual(result, { ...start, width: 80, height: 300 });
});

test("single text floor with bottom fixed moves the top upward", () => {
  assert.deepEqual(single("nw", { x: 120, y: 60 }, start, false, () => 300), {
    x: 220, y: 0, width: 80, height: 300,
  });
});

test("single text floor caps at 2000 and at the allowed height", () => {
  assert.equal(single("se", { x: 1, y: 0 }, start, false, () => 9000).height, 2000);
  const atBottom = { ...start, y: 999900 };
  assert.deepEqual(single("se", { x: 1, y: -60 }, atBottom, false, () => 9000), {
    ...atBottom, width: 201, height: 100,
  });
  assert.deepEqual(single("ne", { x: 1, y: 60 }, atBottom, false, () => 9000), {
    ...atBottom, y: 998000, width: 201, height: 2000,
  });
});

test("single bottom-fixed floor reaches the top board edge then grows downward", () => {
  const rectangle = { ...start, y: -999950 };
  assert.deepEqual(single("nw", { x: 120, y: -1000 }, rectangle, false, () => 1500), {
    x: 220, y: -1e6, width: 80, height: 1500,
  });
});

test("single Shift uses the raw ratio farther from 1 and the larger on a tie", () => {
  for (const [delta, width, height] of [
    [{ x: 100, y: 10 }, 300, 150],
    [{ x: 10, y: -50 }, 100, 50],
    [{ x: 100, y: -50 }, 300, 150],
    [{ x: 80, y: -40 }, 280, 140],
    // Raw width ratio is -2: it dominates even though width alone would clamp to 80.
    [{ x: -600, y: 100 }, 80, 40],
  ]) closeGeometry(single("se", delta, start, true), { ...start, width, height });
});

test("single Shift respects the joint size and board limits at every corner", () => {
  for (const corner of corners) {
    const left = corner.endsWith("w"), top = corner.startsWith("n");
    const result = single(corner, { x: left ? -1e4 : 1e4, y: 0 }, start, true);
    close(result.width, 2000);
    close(result.height, 1000);
    const small = single(corner, { x: left ? 1e4 : -1e4, y: 0 }, start, true);
    close(small.width, 80);
    close(small.height, 40);
    const edge = { ...start, x: left ? -999990 : 999790 };
    const stopped = single(corner, { x: left ? -1000 : 1000, y: 0 }, edge, true);
    close(stopped.width, 210);
    close(stopped.height, 105);
    assert.equal(top ? stopped.y + stopped.height : stopped.y, top ? 300 : 200);
  }
});

test("single text floor overrides Shift proportions after computing width", () => {
  assert.deepEqual(single("ne", { x: -100, y: 0 }, start, true, () => 180), {
    ...start, y: 120, width: 100, height: 180,
  });
});

test("zero delta and returning to the start preserve exact geometry without measuring", () => {
  const fail = () => assert.fail("zero delta must not measure");
  for (const corner of corners) for (const shift of [false, true]) {
    assert.deepEqual(single(corner, { x: 0, y: 0 }, start, shift, fail), start);
    single(corner, { x: 30, y: 30 }, start, shift);
    assert.deepEqual(single(corner, { x: 0, y: 0 }, start, shift, fail), start);
  }
  const members = [member(start, fail), member({ ...start, x: 500 }, fail)];
  assert.deepEqual(resizeSet("se", members, { x: 0, y: 0 }, true), members.map(geometry));
  assert.deepEqual(resizeSet("se", [], { x: 10, y: 10 }, false), []);
});

const pair = [member({ x: 100, y: 200, width: 200, height: 100 }),
  member({ x: 400, y: 350, width: 100, height: 50 })];
// Pair bounds: (100,200) to (500,400), width 400, height 200.
for (const corner of corners) {
  test(`set ${corner} scales every member about its fixed corner`, () => {
    const left = corner.endsWith("w"), top = corner.startsWith("n");
    const fx = left ? 500 : 100, fy = top ? 400 : 200;
    const result = resizeSet(corner, pair, { x: left ? -200 : 200, y: top ? -200 : 200 }, false);
    pair.forEach((o, i) => closeGeometry(result[i], {
      x: fx + (o.x - fx) * 1.5, y: fy + (o.y - fy) * 2,
      width: o.width * 1.5, height: o.height * 2,
    }));
    const shifted = resizeSet(corner, pair, { x: left ? -200 : 200, y: top ? 100 : -100 }, true);
    pair.forEach((o, i) => closeGeometry(shifted[i], {
      x: fx + (o.x - fx) * 1.5, y: fy + (o.y - fy) * 1.5,
      width: o.width * 1.5, height: o.height * 1.5,
    }));
  });
}

for (const [name, change, delta, sx, sy] of [
  ["width 80", { width: 80 }, { x: -100, y: 200 }, 1, 2],
  ["narrow starting width", { width: 50 }, { x: -100, y: 200 }, 1, 2],
  ["width 2000", { width: 2000 }, { x: 1000, y: 200 }, 1, 2],
  ["height 40", { height: 40 }, { x: 400, y: -100 }, 2, 1],
  ["height 2000", { height: 2000 }, { x: 400, y: 1000 }, 2, 1],
]) {
  test(`set member at ${name} limits the whole set independently and with Shift`, () => {
    const members = [member({ ...pair[0], ...change }), pair[1]];
    const bounds = {
      width: Math.max(...members.map((o) => o.x + o.width)) - 100,
      height: Math.max(...members.map((o) => o.y + o.height)) - 200,
    };
    const requested = { x: Math.sign(delta.x) * bounds.width, y: Math.sign(delta.y) * bounds.height };
    const result = resizeSet("se", members, requested, false);
    members.forEach((o, i) => closeGeometry(result[i], {
      x: 100 + (o.x - 100) * sx, y: 200 + (o.y - 200) * sy,
      width: o.width * sx, height: o.height * sy,
    }));
    // Joint expansion is blocked by a maximum; joint contraction by a minimum.
    const contraction = name === "width 80" || name === "narrow starting width" || name === "height 40";
    const direction = contraction ? -1 : 1;
    assert.deepEqual(resizeSet("se", members,
      { x: direction * bounds.width, y: direction * bounds.height }, true), members.map(geometry));
  });
}

test("set each board edge limits all members, with independent or joint scales", () => {
  for (const [corner, dx, dy] of [["nw", -1, -1], ["ne", 1, -1], ["sw", -1, 1], ["se", 1, 1]]) {
    for (const axis of ["x", "y"]) {
      const members = pair.map((o) => member({ ...o,
        x: o.x + (axis === "x" ? dx < 0 ? -1000100 : 999500 : 0),
        y: o.y + (axis === "y" ? dy < 0 ? -1000200 : 999600 : 0),
      }));
      const delta = { x: dx * 400, y: dy * 200 };
      const result = resizeSet(corner, members, delta, false);
      result.forEach((o, i) => {
        close(o.width, members[i].width * (axis === "x" ? 1 : 2));
        close(o.height, members[i].height * (axis === "y" ? 1 : 2));
      });
      assert.deepEqual(resizeSet(corner, members, delta, true), members.map(geometry));
    }
  }
});

test("set limits stop at an approaching member minimum and maximum", () => {
  const shrunk = resizeSet("se", pair, { x: -400, y: -200 }, false);
  close(shrunk[0].width, 160);
  close(shrunk[1].width, 80);
  close(shrunk[0].height, 80);
  close(shrunk[1].height, 40);
  const grown = resizeSet("se", pair, { x: 1e5, y: 1e5 }, false);
  close(grown[0].width, 2000);
  close(grown[1].width, 1000);
  close(grown[0].height, 2000);
  close(grown[1].height, 1000);
});

test("set floor uses each scaled width and grows only that member downward", () => {
  const widths = [];
  const members = [member(pair[0], (width) => { widths.push(width); return 300; }), pair[1]];
  const result = resizeSet("nw", members, { x: 80, y: 0 }, false);
  assert.deepEqual(widths, [160]);
  closeGeometry(result[0], { x: 180, y: 200, width: 160, height: 300 });
  closeGeometry(result[1], { x: 420, y: 350, width: 80, height: 50 });
  assert.ok(result[0].y + result[0].height > 400);
  const capped = resizeSet("se", [member({ ...start, y: 999900 }, () => 9000)], { x: 10, y: 0 }, false);
  assert.equal(capped[0].height, 100);
  assert.equal(resizeSet("se", [member(start, () => 9000)], { x: 10, y: 0 }, false)[0].height, 2000);
});

test("size buttons use bottom-right 10-unit deltas in each direction for one and a set", () => {
  for (const [delta, width, height] of [
    [{ x: 10, y: 0 }, 210, 100], [{ x: -10, y: 0 }, 190, 100],
    [{ x: 0, y: 10 }, 200, 110], [{ x: 0, y: -10 }, 200, 90],
  ]) {
    closeGeometry(single("se", delta), { ...start, width, height });
    const sx = 1 + delta.x / 400, sy = 1 + delta.y / 200;
    resizeSet("se", pair, delta, false).forEach((o, i) => closeGeometry(o, {
      x: 100 + (pair[i].x - 100) * sx, y: 200 + (pair[i].y - 200) * sy,
      width: pair[i].width * sx, height: pair[i].height * sy,
    }));
  }
});

test("size button presses reduced to no change at every size limit", () => {
  for (const [rectangle, delta] of [
    [{ ...start, width: 80 }, { x: -10, y: 0 }],
    [{ ...start, width: 2000 }, { x: 10, y: 0 }],
    [{ ...start, height: 40 }, { x: 0, y: -10 }],
    [{ ...start, height: 2000 }, { x: 0, y: 10 }],
  ]) {
    assert.deepEqual(single("se", delta, rectangle), rectangle);
    const members = [member(rectangle), pair[1]];
    assert.deepEqual(resizeSet("se", members, delta, false), members.map(geometry));
  }
  assert.deepEqual(single("se", { x: 0, y: -10 }, start, false, () => 100), start);
  assert.equal(single("se", { x: -10, y: 0 }, start, false, () => 300).height, 300);
});

test("resize functions preserve caller-owned starting objects", () => {
  const frozen = Object.freeze({ ...start });
  const members = Object.freeze([Object.freeze(member(frozen)), Object.freeze(member(pair[1]))]);
  single("nw", { x: 10, y: 10 }, frozen);
  resizeSet("nw", members, { x: 10, y: 10 }, true);
  assert.deepEqual(frozen, start);
});

test("fractional boundary quotients keep shared scales within exact document limits", () => {
  for (const corner of corners) for (const shift of [false, true]) {
    const left = corner.endsWith("w"), top = corner.startsWith("n");
    for (const size of [123, 199, 1999.3, 123.456]) {
      const rectangle = { x: 100, y: 200, width: size, height: size };
      const delta = { x: left ? -1e5 : 1e5, y: top ? -1e5 : 1e5 };
      const result = single(corner, delta, rectangle, shift);
      assert.ok(result.width <= 2000 && result.height <= 2000);
      close(result.width, 2000);
      close(result.height, 2000);
      const members = [member(rectangle), member({ ...rectangle, x: 500, width: size / 2 })];
      const resized = resizeSet(corner, members, delta, shift);
      resized.forEach((o) => {
        assert.ok(o.width >= 80 && o.width <= 2000 && o.height >= 40 && o.height <= 2000);
        assert.ok(o.x >= -1e6 && o.x + o.width <= 1e6 && o.y >= -1e6 && o.y + o.height <= 1e6);
      });
      close(resized[0].width / members[0].width, resized[1].width / members[1].width);
    }
  }
});

for (const count of [1, 2]) {
  test(`resizing ${count} objects adopts one transaction and undoes/redoes exact geometry`, () => {
    let before = { ...empty(), title: "Synthetic resize board" };
    for (let i = 0; i < 3; i++) before = add(before, i === 1 ? "text" : "sticky", i * 300, i * 100);
    const members = before.objects.slice(0, count).map((o) => member(geometry(o)));
    const resized = count === 1 ? [single("nw", { x: -37.25, y: 20.5 }, members[0])]
      : resizeSet("nw", members, { x: -37.25, y: 20.5 }, false);
    const after = { ...before, objects: before.objects.map((o, i) => i < count ? { ...o, ...resized[i] } : o) };
    validate(after);
    const adapter = new Adapter();
    adapter.set(before);
    let transactions = 0;
    adapter.doc.on("afterTransaction", () => transactions++);
    try {
      const history = record(emptyHistory(), before, after);
      assert.equal(history.past.length, 1);
      assert.equal(history.past[0].changes.length, count);
      adapter.set(after);
      assert.equal(transactions, 1);
      const undone = undo(after, history);
      assert.deepEqual(undone.board, before);
      assert.deepEqual(undone.affectedIds, before.objects.slice(0, count).map((o) => o.id));
      adapter.set(undone.board);
      const redone = redo(undone.board, undone.history);
      assert.deepEqual(redone.board, after);
      adapter.set(redone.board);
      assert.equal(transactions, 3);
      assert.deepEqual(redone.board.objects.slice(count), before.objects.slice(count));
      assert.equal(record(history, after, after), history);
    } finally { adapter.destroy(); }
  });
}

test("cornerPoint returns all four corners of a rectangle", () => {
  const rectangle = { x: 10, y: 20, width: 30, height: 40 };
  for (const [corner, expected] of [
    ["nw", { x: 10, y: 20 }], ["ne", { x: 40, y: 20 }],
    ["sw", { x: 10, y: 60 }], ["se", { x: 40, y: 60 }],
  ]) assert.deepEqual(cornerPoint(corner, rectangle), expected);
});
