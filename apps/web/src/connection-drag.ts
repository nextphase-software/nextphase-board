// SPDX-License-Identifier: Apache-2.0
import { eligibleIdea } from "nextphase-board-rules/objects/registry.ts";
import { insideBox, sideMidpoints, type Side } from "./connectors.ts";
import type { DisplayObject, Point } from "./selection.ts";

export type ConnectionDot = { id: string; side: Side; point: Point; start: Point };
export type ConnectionDrag = { source: string; start: Point; pointer: Point; target: string | null; side?: Side; reconnect?: { id: string; end: "from" | "to" } };
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

export function pressedEnd(layout: import("./connectors.ts").ConnectorLayout, point: Point, zoom: number): "from" | "to" | undefined {
  const from = Math.hypot(point.x - layout.from.x, point.y - layout.from.y) * zoom;
  const to = Math.hypot(point.x - layout.to.x, point.y - layout.to.y) * zoom;
  return Math.min(from, to) > 12 ? undefined : from <= to ? "from" : "to";
}
export function dropSide(rect: DisplayObject, point: Point): Side {
  const distances = [point.x - rect.x, rect.x + rect.width - point.x, point.y - rect.y, rect.y + rect.displayHeight - point.y].map(Math.abs);
  return (["left", "right", "top", "bottom"] as const)[distances.indexOf(Math.min(...distances))];
}
export function reconnectTarget(objects: readonly (DisplayObject & { type: string })[], other: string, point: Point, zoom: number): { target: string; side: Side } | null {
  const eligible = objects.filter((o) => o.id !== other && eligibleIdea(o));
  const dot = pressedDot(connectionDots(eligible, new Set(eligible.map((o) => o.id)), zoom), point, zoom);
  if (dot) return { target: dot.id, side: dot.side };
  const target = connectionTarget(eligible, other, point);
  return target ? { target, side: dropSide(eligible.find((o) => o.id === target)!, point) } : null;
}
