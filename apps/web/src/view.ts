// SPDX-License-Identifier: Apache-2.0
export type View = { x: number; y: number; z: number };
type Point = { x: number; y: number };
type Size = { w: number; h: number };

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export function clampView(view: View): View {
  return {
    x: clamp(view.x, -1e6, 1e6),
    y: clamp(view.y, -1e6, 1e6),
    z: clamp(view.z, .5, 2),
  };
}

export function panView(view: View, delta: Point): View {
  return clampView({
    ...view,
    x: view.x + delta.x / view.z,
    y: view.y + delta.y / view.z,
  });
}

export function wheelDelta(
  x: number, y: number, mode: number, size: Size, shift = false,
): Point {
  x *= mode === 1 ? 16 : mode === 2 ? size.w : 1;
  y *= mode === 1 ? 16 : mode === 2 ? size.h : 1;
  return shift && x === 0 ? { x: y, y: 0 } : { x, y };
}

export function zoomView(view: View, factor: number, point: Point, size: Size): View {
  const z = clamp(view.z * factor, .5, 2);
  return clampView({
    x: view.x + (point.x - size.w / 2) / view.z - (point.x - size.w / 2) / z,
    y: view.y + (point.y - size.h / 2) / view.z - (point.y - size.h / 2) / z,
    z,
  });
}

export function wheelZoomFactor(delta: number): number {
  return Math.exp(-clamp(delta, -25, 25) / 100);
}

export function gestureScale(
  previous: number,
  type: "gesturestart" | "gesturechange" | "gestureend",
  scale?: number,
): { previous: number; factor: number } {
  if (type === "gesturestart") return { previous: 1, factor: 1 };
  if (type !== "gesturechange" || scale === undefined || !Number.isFinite(scale) || scale <= 0) {
    return { previous, factor: 1 };
  }
  return { previous: scale, factor: scale / previous };
}

export function stepZoom(zoom: number, direction: -1 | 1): number {
  const nearest = Math.round(zoom * 4) / 4;
  const current = Math.abs(zoom - nearest) <= .001 ? nearest : zoom;
  return clamp((direction === 1 ? Math.floor(current * 4) + 1 : Math.ceil(current * 4) - 1) / 4, .5, 2);
}

export function screenPoint(o: { x: number; y: number }, view: View, size: Size) {
  return {
    left: size.w / 2 + (o.x - view.x) * view.z,
    top: size.h / 2 + (o.y - view.y) * view.z,
  };
}
