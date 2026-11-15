// SPDX-License-Identifier: Apache-2.0
import test from "node:test";
import assert from "node:assert/strict";
import {
  clampView, gestureScale, panView, screenPoint, stepZoom, wheelDelta, wheelZoomFactor, zoomView,
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
      assert.equal(next.z, Math.max(.1, Math.min(2, z * factor)));
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
  assert.deepEqual(clampView({ x: 2e6, y: -2e6, z: .1 }), { x: 1e6, y: -1e6, z: .1 });
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

test("buttons choose adjacent zoom steps with tolerance and zoom limits", () => {
  for (const [zoom, out, into] of [
    [1, .75, 1.25], [1.1, 1, 1.25], [.5, .25, .75], [.25, .1, .5], [.1, .1, .25], [2, 1.75, 2],
    [1.0004, .75, 1.25], [.9996, .75, 1.25], [1.002, 1, 1.25], [.998, .75, 1],
  ]) {
    assert.equal(stepZoom(zoom, -1), out);
    assert.equal(stepZoom(zoom, 1), into);
  }
});

test("screenPoint maps board points through the view and scene size", () => {
  assert.deepEqual(screenPoint({ x: 0, y: 0 }, { x: 0, y: 0, z: 1 }, size),
    { left: 500, top: 400 });
  assert.deepEqual(screenPoint({ x: 150, y: 0 }, { x: 100, y: -50, z: 2 }, size),
    { left: 600, top: 500 });
});

test('F1-V1 zoom steps span 10–200% with tolerance at every step', async () => {
  const { ZOOM_STEPS } = await import('../apps/web/src/view.ts');
  assert.deepEqual(ZOOM_STEPS,[.1,.25,.5,.75,1,1.25,1.5,1.75,2]);
  for(const [i,z] of ZOOM_STEPS.entries()) for(const delta of [-.0009,0,.0009]) {
    assert.equal(stepZoom(z+delta,-1),ZOOM_STEPS[Math.max(0,i-1)]);
    assert.equal(stepZoom(z+delta,1),ZOOM_STEPS[Math.min(ZOOM_STEPS.length-1,i+1)]);
  }
  assert.equal(clampView({x:0,y:0,z:.01}).z,.1);
});

test('F1-V2 free area measures palette, panel and 160px fallback', async () => {
  const { freeArea } = await import('../apps/web/src/view.ts');
  assert.deepEqual(freeArea({w:1280,h:800},732),{x:12,y:68,width:1256,height:656});
  assert.deepEqual(freeArea({w:1280,h:800},732,980),{x:12,y:68,width:956,height:656});
  assert.deepEqual(freeArea({w:1280,h:800},732,1300),{x:12,y:68,width:1256,height:656});
  assert.deepEqual(freeArea({w:375,h:812},680,180),{x:12,y:12,width:351,height:788});
  assert.deepEqual(freeArea({w:1280,h:240},200),{x:12,y:12,width:1256,height:216});
  assert.deepEqual(freeArea({w:200,h:400},236),{x:12,y:68,width:176,height:160});
});

test('F1-V3 fit uses 48px padding, free-area centre, zoom/pan clamps and zero sides', async () => {
  const { fitView, freeArea } = await import('../apps/web/src/view.ts');
  const scene={w:1280,h:800},area=freeArea(scene,732,980),box={x:40,y:-226,width:640,height:506};
  const view=fitView(box,area,scene),z=Math.min((956-96)/640,(656-96)/506);
  close(view.z,z);close(view.x,360-(490-640)/z);close(view.y,27-(396-400)/z);
  const point=screenPoint({x:360,y:27},view,scene);close(point.left,490);close(point.top,396);
  assert.equal(fitView({x:0,y:0,width:1e6,height:1e6},area,scene).z,.1);
  assert.equal(fitView({x:0,y:0,width:0,height:0},area,scene).z,2);
  assert.deepEqual(fitView({x:2e6,y:-2e6,width:0,height:0},area,scene),{x:1e6,y:-1e6,z:2});
  const zero=fitView({x:0,y:0,width:0,height:1000},area,scene);close(zero.z,.56);
});

test('F1-V4 show preserves the same in-view object, centres a fitting box, otherwise fits', async () => {
  const { showView, fitView, freeArea } = await import('../apps/web/src/view.ts');
  const scene={w:1280,h:800},area=freeArea(scene,732),view=Object.freeze({x:0,y:0,z:1});
  assert.equal(showView({x:-100,y:-100,width:200,height:200},view,area,scene),view);
  // Wholly in view wins even without the fit padding.
  assert.equal(showView({x:-628,y:-332,width:1256,height:656},view,area,scene),view);
  assert.deepEqual(showView({x:1140,y:-80,width:240,height:240},view,area,scene),{x:1260,y:44,z:1});
  const big={x:1000,y:1000,width:2000,height:2000};assert.deepEqual(showView(big,view,area,scene),fitView(big,area,scene));
  assert.equal(showView({x:2e6,y:2e6,width:100,height:100},view,area,scene).x,1e6);
});
