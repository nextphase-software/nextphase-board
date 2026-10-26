// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import { contextBarPosition } from "../apps/web/src/context-bar-position.ts";

function position(overrides = {}) {
  const input = {
    bounds: { x: 0, y: -100, width: 100, height: 60 },
    view: { x: 100, y: -50, z: 2 },
    size: { w: 1280, h: 800 },
    contextWidth: 200,
    layout: { notice: 80, panel: 130 },
    inline: false,
    item: undefined,
    itemHeight: 0,
    ...overrides,
  };
  const { view, size } = input;
  const pos = (o) => ({
    left: size.w / 2 + (o.x - view.x) * view.z,
    top: size.h / 2 + (o.y - view.y) * view.z,
  });
  return contextBarPosition({ ...input, pos });
}

test("no selection keeps the default left and panel top", () => {
  assert.deepEqual(position({ bounds: null }), {
    contextLeft: 12, contextTop: 130, contextFits: true,
  });
});

test("the bar sits above transformed bounds when there is room below the panels", () => {
  assert.deepEqual(position(), {
    contextLeft: 440, contextTop: 252, contextFits: true,
  });
});

test("the bar sits below transformed bounds when there is no room above", () => {
  assert.deepEqual(position({ bounds: { x: 0, y: -180, width: 100, height: 60 } }), {
    contextLeft: 440, contextTop: 268, contextFits: true,
  });
});

test("the left edge clamps at 12", () => {
  assert.deepEqual(position({ bounds: { x: -400, y: -100, width: 100, height: 60 } }), {
    contextLeft: 12, contextTop: 252, contextFits: true,
  });
});

test("the right edge clamps at scene width minus measured width minus 12", () => {
  assert.deepEqual(position({ bounds: { x: 500, y: -100, width: 100, height: 60 } }), {
    contextLeft: 1068, contextTop: 252, contextFits: true,
  });
});

test("the top clamps at scene height minus 52", () => {
  assert.deepEqual(position({ bounds: { x: 0, y: 500, width: 100, height: 60 } }), {
    contextLeft: 440, contextTop: 748, contextFits: true,
  });
});

test("an inline editor under the bar prevents it from fitting", () => {
  const item = {
    id: "example", generation: "example-generation", type: "sticky", text: "Example",
    color: "yellow", textSize: "medium", align: "left", group: null,
    x: 0, y: -100, width: 100, height: 200, order: 0,
  };
  assert.deepEqual(position({
    inline: true, item, itemHeight: 200, layout: { notice: 80, panel: 320 },
  }), { contextLeft: 440, contextTop: 428, contextFits: false });
});

test("an unmeasured bar with width zero does not fit", () => {
  assert.deepEqual(position({ contextWidth: 0 }), {
    contextLeft: 540, contextTop: 252, contextFits: false,
  });
});

test("a scene narrower than 768 hides the bar", () => {
  assert.deepEqual(position({ size: { w: 767, h: 800 } }), {
    contextLeft: 183.5, contextTop: 252, contextFits: false,
  });
});

test("a bar wider than scene width minus 24 does not fit", () => {
  assert.deepEqual(position({ contextWidth: 1257 }), {
    contextLeft: 12, contextTop: 252, contextFits: false,
  });
});

test("a bar whose top plus 40 passes scene height minus 12 does not fit", () => {
  assert.deepEqual(position({ layout: { notice: 80, panel: 770 } }), {
    contextLeft: 440, contextTop: 770, contextFits: false,
  });
});

test("the bar above a section leaves 30 scaled units for the name", () => {
  const item = { type: "section", x: 0, y: -100, width: 640, height: 480 };
  assert.deepEqual(position({ item }), { contextLeft: 440, contextTop: 192, contextFits: true });
  const { contextTop } = position({ item, view: { x: 100, y: -50, z: 1 } });
  assert.equal(contextTop, 272);
});

test("a section's compact name field prevents a bar from covering it at high zoom", () => {
  const item = { type: "section", x: 0, y: 0, width: 200, height: 200 };
  assert.equal(position({ item, bounds: item, inline: true, view: { x: 100, y: -50, z: 4 } }).contextFits, false);
});
