// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import {
  clampView, gestureScale, panView, stepZoom, wheelDelta, wheelZoomFactor, zoomView,
} from "../apps/web/src/view.ts";

const size = { w: 1000, h: 800 };
const pointer = { x: 720, y: 250 };
const close = (actual, expected) => assert(Math.abs(actual - expected) < 1e-8,
  `${actual} should equal ${expected}`);
const boardPoint = (view, point = pointer) => ({
  x: view.x + (point.x - size.w / 2) / view.z,
  y: view.y + (point.y - size.h / 2) / view.z,
});

test("screen deltas pan at 50%, 100% and 200% without mutating the input", () => {
  for (const z of [.5, 1, 2]) {
    const view = Object.freeze({ x: 10, y: -20, z });
    assert.deepEqual(panView(view, { x: -60, y: 120 }),
      { x: 10 - 60 / z, y: -20 + 120 / z, z });
  }
});

test("wheel modes convert pixels, lines and pages before Shift swaps a vertical delta", () => {
  assert.deepEqual(wheelDelta(2, -3, 0, size), { x: 2, y: -3 });
  assert.deepEqual(wheelDelta(2, -3, 1, size), { x: 32, y: -48 });
  assert.deepEqual(wheelDelta(2, -3, 2, size), { x: 2000, y: -2400 });
  for (const [mode, expected] of [[0, -3], [1, -48], [2, -2400]]) {
    assert.deepEqual(wheelDelta(0, -3, mode, size, true), { x: expected, y: 0 });
  }
  assert.deepEqual(wheelDelta(2, -3, 0, size, true), { x: 2, y: -3 });
});

test("zoom preserves the board point under the pointer, including clamped zoom factors", () => {
  for (const z of [.5, 1, 2]) {
    for (const factor of [.01, .8, 1, 1.2, 100]) {
      const view = Object.freeze({ x: 100, y: -200, z });
      const next = zoomView(view, factor, pointer, size);
      assert.equal(next.z, Math.max(.5, Math.min(2, z * factor)));
      close(boardPoint(next).x, boardPoint(view).x);
      close(boardPoint(next).y, boardPoint(view).y);
    }
  }
});

test("at board edges, the anchored point shifts only by the centre clamp", () => {
  for (const sign of [-1, 1]) {
    const view = { x: sign * 999990, y: sign * 999990, z: 1 };
    const point = { x: size.w / 2 + sign * 200, y: size.h / 2 + sign * 100 };
    const next = zoomView(view, 2, point, size);
    assert.deepEqual(next, { x: sign * 1e6, y: sign * 1e6, z: 2 });
    close(boardPoint(next, point).x - boardPoint(view, point).x, -sign * 90);
    close(boardPoint(next, point).y - boardPoint(view, point).y, -sign * 40);
  }
});

test("centre and zoom clamp to their ranges, including pan beyond either edge", () => {
  assert.deepEqual(clampView({ x: 2e6, y: -2e6, z: .1 }), { x: 1e6, y: -1e6, z: .5 });
  assert.deepEqual(clampView({ x: -2e6, y: 2e6, z: 3 }), { x: -1e6, y: 1e6, z: 2 });
  assert.deepEqual(panView({ x: 999999, y: -999999, z: .5 }, { x: 5, y: -5 }),
    { x: 1e6, y: -1e6, z: .5 });
});

test("Ctrl/Cmd wheel zoom limits the converted vertical delta to plus or minus 25", () => {
  for (const delta of [-1000, -25, -10, 0, 10, 25, 1000]) {
    close(wheelZoomFactor(delta), Math.exp(-Math.max(-25, Math.min(25, delta)) / 100));
  }
  close(wheelZoomFactor(wheelDelta(1000, 2, 1, size).y), Math.exp(-.25));
});

test("gesture scale is incremental, ignores invalid values and resets at every start", () => {
  let state = gestureScale(3, "gesturestart");
  assert.deepEqual(state, { previous: 1, factor: 1 });
  let zoom = 1;
  for (const scale of [1.2, 1.44]) {
    state = gestureScale(state.previous, "gesturechange", scale);
    close(state.factor, 1.2);
    zoom *= state.factor;
  }
  close(zoom, 1.44);
  for (const invalid of [0, -1, NaN, Infinity, -Infinity, undefined]) {
    assert.deepEqual(gestureScale(state.previous, "gesturechange", invalid),
      { previous: 1.44, factor: 1 });
  }
  assert.deepEqual(gestureScale(state.previous, "gestureend", 2), { previous: 1.44, factor: 1 });
  // A missing end cannot carry scale into the next pinch.
  state = gestureScale(state.previous, "gesturestart");
  close(gestureScale(state.previous, "gesturechange", 1.2).factor, 1.2);
});

test("a blocked gesture can advance its scale without applying its factor", () => {
  const blocked = gestureScale(1, "gesturechange", 1.2);
  const resumed = gestureScale(blocked.previous, "gesturechange", 1.44);
  close(resumed.factor, 1.2);
});

test("buttons choose adjacent quarter steps with tolerance and zoom limits", () => {
  for (const [zoom, out, into] of [
    [1, .75, 1.25], [1.1, 1, 1.25], [.5, .5, .75], [2, 1.75, 2],
    [1.0004, .75, 1.25], [.9996, .75, 1.25], [1.002, 1, 1.25], [.998, .75, 1],
  ]) {
    assert.equal(stepZoom(zoom, -1), out);
    assert.equal(stepZoom(zoom, 1), into);
  }
});
