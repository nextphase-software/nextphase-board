// SPDX-License-Identifier: Apache-2.0
import { clamp, freshIdentifier, type BoardV10, type StrokeItem, type ItemV10 } from "./document.ts";
import { isImage, hasPoints, hasRectangle, hasText, usesShapePaint, inkInfo, inkWidth, inkColors, typeWithPoints, rectangleType, type StrokeKeys, type InkPoint, type InkWeight } from "./objects/registry.ts";
import { cornerPoint, type Corner, type Rectangle } from "./resize.ts";
import type { Style } from "./styles.ts";
import type { Point } from "./selection.ts";

export function drawingPoints(positions: readonly Point[], straight = false): Point[] {
  let points = straight ? [positions[0], positions.at(-1)!] : positions.map((p, i) => i === 0 || i === positions.length - 1 ? p
    : { x: (positions[i - 1].x + 2 * p.x + positions[i + 1].x) / 4, y: (positions[i - 1].y + 2 * p.y + positions[i + 1].y) / 4 });
  if (points.length > 1000) points = Array.from({ length: 1000 }, (_, i) => points[Math.round(i * (points.length - 1) / 999)]);
  return points;
}
export function strokeGeometry(positions: readonly Point[], style: Pick<StrokeKeys, "kind" | "weight">): Rectangle & { points: InkPoint[] } {
  const pad = inkWidth(style) / 2;
  const points = positions.map((p) => ({ x: clamp(Math.round(p.x), -1e6 + pad, 1e6 - pad), y: clamp(Math.round(p.y), -1e6 + pad, 1e6 - pad) }));
  return paddedBounds(points, pad);
}
function paddedBounds(points: readonly Point[], pad: number): Rectangle & { points: InkPoint[] } {
  const x = Math.min(...points.map((p) => p.x)) - pad, y = Math.min(...points.map((p) => p.y)) - pad;
  return { x, y, width: Math.max(...points.map((p) => p.x)) + pad - x,
    height: Math.max(...points.map((p) => p.y)) + pad - y, points: points.map((p) => [p.x - x, p.y - y]) };
}
export const absolutePoints = (o: StrokeItem): Point[] => o.points.map(([x, y]) => ({ x: o.x + x, y: o.y + y }));
export function makeStroke(board: BoardV10, positions: readonly Point[], style: Omit<StrokeKeys, "points">, crossed: boolean, straight = false): StrokeItem | null {
  if (board.objects.length >= 250) throw Error("250 object limit reached");
  if (!crossed && !inkInfo(style).round) return null;
  const points = crossed ? drawingPoints(positions, straight) : [positions[0], positions[0]];
  const id = freshIdentifier(board);
  return { id, generation: freshIdentifier(board, [id]), type: typeWithPoints().type,
    ...style, group: null, section: null, ...strokeGeometry(points, style), order: board.objects.length };
}
export function changeStrokeWeight(o: StrokeItem, weight: InkWeight): StrokeItem {
  if (o.weight === weight) return o;
  const change = (inkWidth({ ...o, weight }) - inkWidth(o)) / 2;
  const next = { ...o, weight, x: o.x - change, y: o.y - change, width: o.width + 2 * change,
    height: o.height + 2 * change, points: o.points.map(([x, y]): InkPoint => [x + change, y + change]) };
  if (!withinBoard(next)) throw Error("The stroke would exceed the board edges.");
  return next;
}
export function changeOrdinaryColor(objects: readonly ItemV10[], selected: ReadonlySet<string>, color: Style["color"]): ItemV10[] {
  return objects.map((o) => hasRectangle(o) && hasText(o) && !usesShapePaint(o) && selected.has(o.id) && o.color !== color ? { ...o, color } : o);
}
export function changeStrokeColor(objects: readonly ItemV10[], selected: ReadonlySet<string>, color: string): ItemV10[] {
  const targets = objects.filter(hasPoints).filter((o) => selected.has(o.id));
  if (!targets.length || targets.some((o) => o.kind !== targets[0].kind) || !inkColors(targets[0]).some((c) => c.name === color)) return [...objects];
  return objects.map((o) => hasPoints(o) && selected.has(o.id) && o.color !== color ? { ...o, color } : o);
}
export function strokeInBox(o: Rectangle, box: Rectangle): boolean {
  return o.x >= box.x && o.y >= box.y && o.x + o.width <= box.x + box.width && o.y + o.height <= box.y + box.height;
}
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function pointSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  const t = length ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / length, 0, 1) : 0;
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}
function segmentDistance(a: Point, b: Point, c: Point, d: Point): number {
  const cross = (u: Point, v: Point, w: Point) => (v.x - u.x) * (w.y - u.y) - (v.y - u.y) * (w.x - u.x);
  if (Math.max(a.x, b.x) >= Math.min(c.x, d.x) && Math.max(c.x, d.x) >= Math.min(a.x, b.x) &&
    Math.max(a.y, b.y) >= Math.min(c.y, d.y) && Math.max(c.y, d.y) >= Math.min(a.y, b.y) &&
    cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0) return 0;
  return Math.min(pointSegmentDistance(a, c, d), pointSegmentDistance(b, c, d), pointSegmentDistance(c, a, b), pointSegmentDistance(d, a, b));
}
// Distance to each painted segment rectangle and its round joins. Flat endpoints
// deliberately do not acquire a round cap when testing a highlight's ink.
function inkDistance(o: StrokeItem, a: Point, b: Point): number {
  const points = absolutePoints(o), pad = inkWidth(o) / 2;
  let result = Infinity;
  for (let i = 1; i < points.length; i++) {
    const c = points[i - 1], d = points[i], length = distance(c, d);
    if (inkInfo(o).round) { result = Math.min(result, Math.max(0, segmentDistance(a, b, c, d) - pad)); continue; }
    if (!length) continue;
    const nx = -(d.y - c.y) * pad / length, ny = (d.x - c.x) * pad / length;
    const vertices = [{ x: c.x + nx, y: c.y + ny }, { x: d.x + nx, y: d.y + ny }, { x: d.x - nx, y: d.y - ny }, { x: c.x - nx, y: c.y - ny }];
    const inside = (p: Point) => {
      const along = ((p.x - c.x) * (d.x - c.x) + (p.y - c.y) * (d.y - c.y)) / length;
      const across = Math.abs((p.x - c.x) * (d.y - c.y) - (p.y - c.y) * (d.x - c.x)) / length;
      return along >= 0 && along <= length && across <= pad;
    };
    if (inside(a) || inside(b)) return 0;
    for (let j = 0; j < 4; j++) result = Math.min(result, segmentDistance(a, b, vertices[j], vertices[(j + 1) % 4]));
    if (i < points.length - 1) result = Math.min(result, Math.max(0, pointSegmentDistance(d, a, b) - pad));
  }
  return result;
}
export function strokeHit(o: StrokeItem, p: Point, zoom: number): boolean {
  const points = absolutePoints(o);
  return points.slice(1).some((b, i) => pointSegmentDistance(p, points[i], b) <= 8 / zoom) || inkDistance(o, p, p) === 0;
}
export function erasedStrokes(objects: readonly ItemV10[], path: readonly Point[], zoom: number): StrokeItem[] {
  if (!path.length) return [];
  return objects.filter(hasPoints).filter((o) => path.some((p, i) => inkDistance(o, i ? path[i - 1] : p, p) <= 6 / zoom));
}
const withinBoard = (o: Rectangle) => o.x >= -1e6 && o.y >= -1e6 && o.x + o.width <= 1e6 && o.y + o.height <= 1e6;
export const strokeFloor = (o: StrokeItem) => {
  const side = Math.max(o.width, o.height) - inkWidth(o);
  return side > 8 ? 8 / side : 1;
};
export function scaleStroke(o: StrokeItem, factor: number, corner: Corner, opposite: Point): StrokeItem {
  const pad = inkWidth(o) / 2, east = corner.endsWith("e"), south = corner.startsWith("s");
  const ox = east ? pad : o.width - pad, oy = south ? pad : o.height - pad;
  const relative = o.points.map(([x, y]) => ({ x: Math.round((x - ox) * factor), y: Math.round((y - oy) * factor) }));
  const g = paddedBounds(relative, pad);
  return { ...o, ...g, x: east ? opposite.x : opposite.x - g.width, y: south ? opposite.y : opposite.y - g.height };
}
export function resizeWithStrokes(corner: Corner, members: readonly { object: Exclude<ItemV10, import("./document.ts").ConnectorItem>; rectangle: Rectangle }[], delta: Point,
  neededHeight: (object: Exclude<ItemV10, import("./document.ts").ConnectorItem>, width: number) => number): (ItemV10 & Rectangle)[] {
  if (!members.length || !delta.x && !delta.y) return members.map((m) => m.object);
  const x = Math.min(...members.map((m) => m.rectangle.x)), y = Math.min(...members.map((m) => m.rectangle.y));
  const bounds = { x, y, width: Math.max(...members.map((m) => m.rectangle.x + m.rectangle.width)) - x,
    height: Math.max(...members.map((m) => m.rectangle.y + m.rectangle.height)) - y };
  const east = corner.endsWith("e"), south = corner.startsWith("s");
  const fixed = cornerPoint(({ nw: "se", ne: "sw", sw: "ne", se: "nw" } as const)[corner], bounds);
  const sx = 1 + (east ? delta.x : -delta.x) / bounds.width, sy = 1 + (south ? delta.y : -delta.y) / bounds.height;
  const wanted = sx >= 1 && sy >= 1 ? Math.max(sx, sy) : sx <= 1 && sy <= 1 ? Math.min(sx, sy) : sx + sy >= 2 ? Math.max(sx, sy) : Math.min(sx, sy);
  const floor = Math.max(...members.map(({ object: o, rectangle: r }) => hasPoints(o) ? strokeFloor(o)
    : Math.max(Math.min(Math.max(isImage(o) ? 1 : 80, rectangleType(o.type).sizeRange.min), r.width) / r.width, rectangleType(o.type).sizeRange.min / r.height)));
  const project = (s: number) => members.map(({ object: o, rectangle: r }) => {
    if (s === 1) return o;
    const opposite = { x: fixed.x + (r.x + (east ? 0 : r.width) - fixed.x) * s,
      y: fixed.y + (r.y + (south ? 0 : r.height) - fixed.y) * s };
    if (hasPoints(o)) return scaleStroke(o, s, corner, opposite);
    const width = r.width * s, height = Math.max(r.height * s, Math.min(neededHeight(o, width), rectangleType(o.type).sizeRange.max, 1e6 - (fixed.y + (r.y - fixed.y) * s)));
    return { ...o, x: fixed.x + (r.x - fixed.x) * s, y: fixed.y + (r.y - fixed.y) * s, width, height };
  });
  const valid = (s: number) => project(s).every((o) => withinBoard(o) && (hasPoints(o) || o.width <= rectangleType(o.type).sizeRange.max && o.height <= rectangleType(o.type).sizeRange.max));
  let factor = Math.max(floor, wanted);
  if (!valid(factor)) {
    let good = 1, bad = factor;
    for (let i = 0; i < 60; i++) { const mid = (good + bad) / 2; if (valid(mid)) good = mid; else bad = mid; }
    factor = good;
  }
  return project(factor);
}
