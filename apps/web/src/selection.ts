// SPDX-License-Identifier: Apache-2.0
export type Point = { x: number; y: number };
type Geometry = Point & { width: number; height: number };
export type DisplayObject = Geometry & { id: string; order: number; displayHeight: number };

export function boundingBox(objects: readonly DisplayObject[]) {
  if (!objects.length) return null;
  const x = Math.min(...objects.map((o) => o.x));
  const y = Math.min(...objects.map((o) => o.y));
  return {
    x, y,
    width: Math.max(...objects.map((o) => o.x + o.width)) - x,
    height: Math.max(...objects.map((o) => o.y + o.displayHeight)) - y,
  };
}

export function boxSelection(start: Point, end: Point, objects: readonly DisplayObject[]): string[] {
  const left = Math.min(start.x, end.x), right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y), bottom = Math.max(start.y, end.y);
  return objects.filter((o) => o.x <= right && o.x + o.width >= left &&
    o.y <= bottom && o.y + o.displayHeight >= top)
    .sort((a, b) => a.order - b.order).map((o) => o.id);
}

// Clamp the shared delta, never the individual positions. Movement uses saved height.
export function limitMove(objects: readonly Geometry[], delta: Point): Point {
  if (!objects.length) return { x: 0, y: 0 };
  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
  return {
    x: clamp(delta.x, Math.max(...objects.map((o) => -1e6 - o.x)),
      Math.min(...objects.map((o) => 1e6 - o.width - o.x))),
    y: clamp(delta.y, Math.max(...objects.map((o) => -1e6 - o.y)),
      Math.min(...objects.map((o) => 1e6 - o.height - o.y))),
  };
}
