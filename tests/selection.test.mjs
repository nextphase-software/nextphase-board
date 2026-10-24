// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { boundingBox, boxSelection, limitMove } from "../apps/web/src/selection.ts";

const object = (id, x, y, order, extra = {}) => ({
  id, x, y, width: 40, height: 40, displayHeight: 40, order, ...extra,
});

test("box touches interiors, overlaps, edges and corners inclusively in reading order", () => {
  const objects = [
    object("outside", 201, 100, 5), object("corner", 200, 200, 4),
    object("edge", 200, 120, 3), object("partial", 80, 90, 2),
    object("inside", 120, 120, 1), object("tall", 130, 0, 0, { displayHeight: 100 }),
  ];
  const expected = ["tall", "inside", "partial", "edge", "corner"];
  assert.deepEqual(boxSelection({ x: 100, y: 100 }, { x: 200, y: 200 }, objects), expected);
  assert.deepEqual(boxSelection({ x: 200, y: 200 }, { x: 100, y: 100 }, objects), expected);
  assert.deepEqual(boxSelection({ x: 200, y: 100 }, { x: 100, y: 200 }, objects), expected);
  assert.deepEqual(boxSelection({ x: 100, y: 100 }, { x: 200, y: 200 }, []), []);
});

test("zero-height and zero-width boxes still touch the drawn rectangles", () => {
  const objects = [object("a", 0, 0, 0), object("b", 40, 40, 1), object("c", 81, 41, 2)];
  assert.deepEqual(boxSelection({ x: -10, y: 40 }, { x: 80, y: 40 }, objects), ["a", "b"]);
  assert.deepEqual(boxSelection({ x: 40, y: -10 }, { x: 40, y: 80 }, objects), ["a", "b"]);
  assert.deepEqual(boxSelection({ x: 40, y: 40 }, { x: 40, y: 40 }, objects), ["a", "b"]);
});

test("set movement clamps one shared delta at each bound and preserves relative positions", () => {
  const objects = [object("a", -999990, -999980, 0), object("b", 999900, 999910, 1)];
  assert.deepEqual(limitMove(objects, { x: 5, y: 10 }), { x: 5, y: 10 });
  for (const [requested, expected] of [
    [{ x: -100, y: 0 }, { x: -10, y: 0 }],
    [{ x: 100, y: 0 }, { x: 60, y: 0 }],
    [{ x: 0, y: -100 }, { x: 0, y: -20 }],
    [{ x: 0, y: 100 }, { x: 0, y: 50 }],
    [{ x: 100, y: -100 }, { x: 60, y: -20 }],
  ]) {
    const delta = limitMove(objects, requested);
    assert.deepEqual(delta, expected);
    const moved = objects.map((o) => ({ ...o, x: o.x + delta.x, y: o.y + delta.y }));
    assert.equal(moved[1].x - moved[0].x, objects[1].x - objects[0].x);
    assert.equal(moved[1].y - moved[0].y, objects[1].y - objects[0].y);
    for (const o of moved) {
      assert.ok(o.x >= -1e6 && o.x + o.width <= 1e6);
      assert.ok(o.y >= -1e6 && o.y + o.height <= 1e6);
    }
    assert.deepEqual(limitMove(moved, requested), { x: 0, y: 0 });
  }
  // Movement uses saved height, while selection uses display height.
  assert.deepEqual(limitMove([object("tall", 0, 999950, 0, { displayHeight: 500 })], { x: 0, y: 100 }), { x: 0, y: 10 });
  assert.deepEqual(limitMove([], { x: 10, y: 10 }), { x: 0, y: 0 });
});

test("bounding box includes display heights for one or several objects", () => {
  const a = object("a", -50, 20, 0, { displayHeight: 200 });
  assert.deepEqual(boundingBox([a]), { x: -50, y: 20, width: 40, height: 200 });
  assert.deepEqual(boundingBox([a, object("b", 100, -30, 1)]), { x: -50, y: -30, width: 190, height: 250 });
  assert.equal(boundingBox([]), null);
});
