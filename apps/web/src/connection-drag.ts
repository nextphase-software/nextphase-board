// SPDX-License-Identifier: Apache-2.0
import { eligibleIdea } from "./objects/registry.ts";
import { insideBox, sideMidpoints, type Side } from "./connectors.ts";
import type { DisplayObject, Point } from "./selection.ts";

export type ConnectionDot = { id: string; side: Side; point: Point; start: Point };
export type ConnectionDrag = { source: string; start: Point; pointer: Point; target: string | null };
export function connectionDots(objects: readonly (DisplayObject & { type: string })[], selected: ReadonlySet<string>, zoom: number): ConnectionDot[] {
  return objects.filter((o) => selected.has(o.id) && eligibleIdea(o)).flatMap((o) => sideMidpoints(o).map((p) => ({
    id: o.id, side: p.side, start: { x: p.x, y: p.y },
    point: { x: p.x + p.normal.x * 18 / zoom, y: p.y + p.normal.y * 18 / zoom },
  })));
}
export function pressedDot(dots: readonly ConnectionDot[], point: Point, zoom: number): ConnectionDot | undefined {
  return [...dots].reverse().find((d) => Math.hypot(point.x - d.point.x, point.y - d.point.y) * zoom <= 8);
}
export function connectionTarget(objects: readonly (DisplayObject & { type: string })[], source: string, point: Point): string | null {
  return [...objects].reverse().find((o) => o.id !== source && eligibleIdea(o) && insideBox(point, { ...o, height: o.displayHeight }))?.id ?? null;
}
