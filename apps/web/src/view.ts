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
    z: clamp(view.z, .1, 2),
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
  const z = clamp(view.z * factor, .1, 2);
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

export const ZOOM_STEPS = [.1, .25, .5, .75, 1, 1.25, 1.5, 1.75, 2] as const;
export function stepZoom(zoom: number, direction: -1 | 1): number {
  const current = ZOOM_STEPS.find(step => Math.abs(zoom - step) <= .001) ?? zoom;
  return direction === 1 ? ZOOM_STEPS.find(step => step > current) ?? 2
    : [...ZOOM_STEPS].reverse().find(step => step < current) ?? .1;
}

type Box = Point & { width: number; height: number };
export function freeArea(size: Size, paletteTop: number, panelLeft?: number): Box {
  const right = Math.min(size.w - 12, panelLeft === undefined ? size.w - 12 : panelLeft - 12);
  const area = { x: 12, y: 68, width: right - 12, height: paletteTop - 8 - 68 };
  return area.width < 160 || area.height < 160
    ? { x: 12, y: 12, width: size.w - 24, height: size.h - 24 } : area;
}
function centredView(box: Box, z: number, area: Box, size: Size): View {
  return clampView({ x: box.x + box.width / 2 - (area.x + area.width / 2 - size.w / 2) / z,
    y: box.y + box.height / 2 - (area.y + area.height / 2 - size.h / 2) / z, z });
}
export function fitView(box: Box, area: Box, size: Size): View {
  const z = clamp(Math.min((area.width - 96) / (box.width || 1), (area.height - 96) / (box.height || 1)), .1, 2);
  return centredView(box, z, area, size);
}
export function showView(box: Box, view: View, area: Box, size: Size): View {
  const { left, top } = screenPoint(box, view, size);
  if (left >= area.x && top >= area.y && left + box.width * view.z <= area.x + area.width &&
      top + box.height * view.z <= area.y + area.height) return view;
  return box.width * view.z <= area.width - 96 && box.height * view.z <= area.height - 96
    ? centredView(box, view.z, area, size) : fitView(box, area, size);
}

export function screenPoint(o: { x: number; y: number }, view: View, size: Size) {
  return {
    left: size.w / 2 + (o.x - view.x) * view.z,
    top: size.h / 2 + (o.y - view.y) * view.z,
  };
}
