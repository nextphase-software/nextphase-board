// SPDX-License-Identifier: Apache-2.0
import { lineWidth, type ConnectorStyle } from "nextphase-board-rules/objects/registry.ts";
import type { Point } from "./selection.ts";

export type ConnectorHead = { points: Point[]; circle?: Point & { radius: number }; filled: boolean;
  width: number; inset: number; extent: Point[]; d: number };
export function connectorHead(kind: ConnectorStyle["startHead"], p: Point, n: Point,
  weight: ConnectorStyle["lineWeight"], N: Point = n): ConnectorHead {
  const scale = weight === "thick" ? 1.6 : 1;
  const at = (a: number, b: number): Point => ({ x: p.x + scale * (a * n.x - b * n.y), y: p.y + scale * (a * n.y + b * n.x) });
  const shapes: Record<ConnectorStyle["startHead"], { points: Point[]; filled: boolean; width: number; inset: number; circle?: Point & { radius: number } }> = {
    none: { points: [], filled: false, width: 0, inset: 0 },
    "line-arrow": { points: [at(16, 11.2), at(0, 0), at(16, -11.2)], filled: false, width: lineWidth({ lineWeight: weight }), inset: 0 },
    "solid-arrow": { points: [at(0, 0), at(18, 10), at(18, -10)], filled: true, width: 2, inset: 18 * scale },
    triangle: { points: [at(0, 10), at(18, 0), at(0, -10)], filled: true, width: 2, inset: 18 * scale },
    circle: { points: [], circle: { ...at(8, 0), radius: 8 * scale }, filled: true, width: 0, inset: 16 * scale },
    diamond: { points: [at(0, 0), at(10, 9), at(20, 0), at(10, -9)], filled: true, width: 0, inset: 20 * scale },
  };
  const head = shapes[kind], projection = (q: Point) => (q.x - p.x) * N.x + (q.y - p.y) * N.y;
  const minimum = head.circle ? projection(head.circle) - head.circle.radius : Math.min(0, ...head.points.map(projection));
  const dot = n.x * N.x + n.y * N.y, d = n.x === N.x && n.y === N.y ? 0 : dot > 0 ? Math.max(0, -minimum) / dot : 0;
  const shift = (q: Point) => ({ x: q.x + d * n.x, y: q.y + d * n.y });
  const points = head.points.map(shift), circle = head.circle ? { ...shift(head.circle), radius: head.circle.radius } : undefined;
  const extent = circle ? [{ x: circle.x - circle.radius, y: circle.y - circle.radius },
    { x: circle.x + circle.radius, y: circle.y + circle.radius }] : points;
  return { ...head, points, circle, extent, d, inset: head.inset + d };
}
