// SPDX-License-Identifier: Apache-2.0
import { freshIdentifier, type BoardV8, type ConnectorItem, type ItemV8 } from "./document.ts";
import { editingCommandReason } from "./commands.ts";
import { eligibleIdea, hasPoints, hasEnds, hasRectangle, isContainer, orderBand, typeWithEnds, type EndsKeys } from "./objects/registry.ts";
import { boxSelection, type DisplayObject, type Point } from "./selection.ts";
import { strokeHit, strokeInBox } from "./strokes.ts";
import type { Rectangle } from "./resize.ts";

export const FOLLOW_REASON = "Connectors follow the ideas they join.";
export const COPY_REASON = "Select both ideas to copy their connector.";
export type DrawnRectangle = Rectangle & { displayHeight?: number };
export type Side = "left" | "right" | "top" | "bottom";
export type Midpoint = Point & { side: Side; normal: Point };
export type ConnectorLayout = {
  vertices: Point[]; path: string; samples: Point[]; arrow: Point[];
  from: Midpoint; to: Midpoint; lead: number; labelPoint: Point;
  labelBox: Rectangle; bounds: Rectangle;
};
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const mix = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const plain = ({ x, y }: Point): Point => ({ x, y });
export function sideMidpoints(rect: DrawnRectangle): Midpoint[] {
  const h = rect.displayHeight ?? rect.height;
  return [
    { x: rect.x, y: rect.y + h / 2, side: "left", normal: { x: -1, y: 0 } },
    { x: rect.x + rect.width, y: rect.y + h / 2, side: "right", normal: { x: 1, y: 0 } },
    { x: rect.x + rect.width / 2, y: rect.y, side: "top", normal: { x: 0, y: -1 } },
    { x: rect.x + rect.width / 2, y: rect.y + h, side: "bottom", normal: { x: 0, y: 1 } },
  ];
}
export function connectorRoute(from: DrawnRectangle, to: DrawnRectangle) {
  let a = sideMidpoints(from)[0], b = sideMidpoints(to)[0], d = Infinity;
  for (const x of sideMidpoints(from)) for (const y of sideMidpoints(to)) {
    const next = distance(x, y);
    if (next < d) { a = x; b = y; d = next; }
  }
  const n = a.normal, m = b.normal, lead = Math.min(24, Math.max(12, d / 4));
  let vertices: Point[];
  if (m.x === -n.x && m.y === -n.y && (b.x - a.x) * n.x + (b.y - a.y) * n.y > 0) {
    vertices = n.x ? [a, { x: (a.x + b.x) / 2, y: a.y }, { x: (a.x + b.x) / 2, y: b.y }, b]
      : [a, { x: a.x, y: (a.y + b.y) / 2 }, { x: b.x, y: (a.y + b.y) / 2 }, b];
  } else {
    const p = { x: a.x + lead * n.x, y: a.y + lead * n.y };
    const q = { x: b.x + lead * m.x, y: b.y + lead * m.y };
    vertices = n.x && m.x ? [a, p, { x: (p.x + q.x) / 2, y: p.y }, { x: (p.x + q.x) / 2, y: q.y }, q, b]
      : n.y && m.y ? [a, p, { x: p.x, y: (p.y + q.y) / 2 }, { x: q.x, y: (p.y + q.y) / 2 }, q, b]
      : n.x ? [a, p, { x: q.x, y: p.y }, q, b] : [a, p, { x: p.x, y: q.y }, q, b];
  }
  return { from: a, to: b, lead, vertices: vertices.filter((v, i) => !i || !same(v, vertices[i - 1])).map(plain) };
}
export function roundedPath(vertices: readonly Point[]) {
  const samples: Point[] = vertices.length ? [vertices[0]] : [], extrema = [...samples];
  let path = vertices.length ? `M ${vertices[0].x} ${vertices[0].y}` : "";
  for (let i = 1; i < vertices.length - 1; i++) {
    const u = vertices[i - 1], c = vertices[i], w = vertices[i + 1];
    const before = distance(u, c), after = distance(c, w), r = Math.min(14, before / 2, after / 2);
    if (r < 1) { path += ` L ${c.x} ${c.y}`; samples.push(c); extrema.push(c); continue; }
    const start = mix(c, u, r / before), end = mix(c, w, r / after);
    path += ` L ${start.x} ${start.y} Q ${c.x} ${c.y} ${end.x} ${end.y}`;
    const curve = (t: number) => mix(mix(start, c, t), mix(c, end, t), t);
    samples.push(start);
    for (let step = 1; step <= 16; step++) samples.push(curve(step / 16));
    extrema.push(start, end);
    for (const axis of ["x", "y"] as const) {
      const t = (start[axis] - c[axis]) / (start[axis] - 2 * c[axis] + end[axis]);
      if (t > 0 && t < 1) extrema.push(curve(t));
    }
  }
  if (vertices.length > 1) {
    const last = vertices.at(-1)!;
    path += ` L ${last.x} ${last.y}`; samples.push(last); extrema.push(last);
  }
  return { path, samples, extrema };
}
export function halfway(vertices: readonly Point[]): Point {
  const lengths = vertices.slice(1).map((v, i) => distance(vertices[i], v));
  let remaining = lengths.reduce((a, b) => a + b, 0) / 2;
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i]) return mix(vertices[i], vertices[i + 1], remaining / lengths[i]);
    remaining -= lengths[i];
  }
  return vertices[0];
}
export function labelBox(point: Point, text: string, measure: (text: string) => number): Rectangle {
  const lines = text.split(/\r\n|[\r\n]/), width = Math.max(90, 24 + Math.max(...lines.map(measure)));
  const height = Math.max(34, lines.length * 26.1);
  return { x: point.x - width / 2, y: point.y - height / 2, width, height };
}
export function labelEditorBox(point: Point, text: string): Rectangle {
  return labelBox(point, text, (line) => Array.from(line).length * 10);
}
export function arrowPoints(to: Midpoint): Point[] {
  const m = to.normal, back = { x: to.x + 16 * m.x, y: to.y + 16 * m.y };
  return [{ x: back.x - 11.2 * m.y, y: back.y + 11.2 * m.x }, plain(to),
    { x: back.x + 11.2 * m.y, y: back.y - 11.2 * m.x }];
}
function enclosing(points: readonly Point[]): Rectangle {
  const x = Math.min(...points.map((p) => p.x)), y = Math.min(...points.map((p) => p.y));
  return { x, y, width: Math.max(...points.map((p) => p.x)) - x, height: Math.max(...points.map((p) => p.y)) - y };
}
export function connectorLayout(object: Pick<ConnectorItem, "from" | "to" | "text">,
  rectangles: ReadonlyMap<string, DrawnRectangle>, measure: (text: string) => number): ConnectorLayout {
  const route = connectorRoute(rectangles.get(object.from.object)!, rectangles.get(object.to.object)!);
  const rounded = roundedPath(route.vertices), arrow = arrowPoints(route.to), labelPoint = halfway(route.vertices);
  const box = labelBox(labelPoint, object.text, measure);
  const bounds = enclosing([...rounded.extrema, ...arrow, ...(object.text ? [box, { x: box.x + box.width, y: box.y + box.height }] : [])]);
  return { ...route, path: rounded.path, samples: rounded.samples, arrow, labelPoint, labelBox: box, bounds };
}
export const insideBox = (p: Point, b: Rectangle) => p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
function segmentDistance(p: Point, a: Point, b: Point): number {
  const square = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  const t = square ? Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / square)) : 0;
  return distance(p, mix(a, b, t));
}
export function lineHit(layout: ConnectorLayout, p: Point, zoom: number): boolean {
  return [layout.samples, layout.arrow].some((points) => points.slice(1).some((b, i) => segmentDistance(p, points[i], b) * zoom <= 8));
}
export function connectorInBox(layout: ConnectorLayout, box: Rectangle): boolean {
  const b = layout.bounds;
  return insideBox(b, box) && insideBox({ x: b.x + b.width, y: b.y + b.height }, box);
}
export function selectInBox<T extends DisplayObject & { type: string; connectorLayout?: ConnectorLayout }>(start: Point, end: Point, objects: readonly T[]): string[] {
  const box = { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
  const rectangles = new Set(boxSelection(start, end, objects.filter(hasRectangle).filter((o) => !hasPoints(o) || strokeInBox(o, box))));
  return objects.filter((o) => rectangles.has(o.id) || hasEnds(o) && connectorInBox(o.connectorLayout!, box))
    .sort((a, b) => a.order - b.order).map((o) => o.id);
}
export function hitObject<T extends DisplayObject & { type: string; text?: string; connectorLayout?: ConnectorLayout }>(objects: readonly T[], point: Point, zoom: number): T | undefined {
  const ordered = bands(objects).reverse(), rectangles = ordered.filter((o) => orderBand(o) === 2);
  return rectangles.find((o) => hasPoints(o) ? strokeHit(o as unknown as import("./document.ts").StrokeItem, point, zoom) : insideBox(point, { ...o, height: o.displayHeight }))
    ?? ordered.find((o) => hasEnds(o) && o.text && insideBox(point, o.connectorLayout!.labelBox))
    ?? ordered.find((o) => hasEnds(o) && lineHit(o.connectorLayout!, point, zoom))
    ?? ordered.find((o) => isContainer(o) && insideBox(point, { ...o, height: o.displayHeight }));
}
export function bands<T extends { type: string }>(objects: readonly T[]): T[] {
  return [0, 1, 2].flatMap((band) => objects.filter((o) => orderBand(o) === band));
}
export function cascade<T extends { id: string; type: string }>(objects: readonly T[], selected: ReadonlySet<string>): Set<string> {
  return new Set(objects.filter((o) => selected.has(o.id) || hasEnds(o) &&
    (selected.has(o.from.object) || selected.has(o.to.object))).map((o) => o.id));
}
export function cascadeCount(objects: readonly { id: string; type: string }[], selected: ReadonlySet<string>): number {
  const removed = cascade(objects, selected);
  return objects.filter((o) => removed.has(o.id) && hasEnds(o)).length;
}
export function copiedSet(objects: readonly { id: string; type: string; section?: string | null }[], selected: ReadonlySet<string>): Set<string> {
  const sections = new Set(objects.filter((o) => selected.has(o.id) && isContainer(o)).map((o) => o.id));
  const copied = new Set(objects.filter((o) => hasRectangle(o) && (selected.has(o.id) || !!o.section && sections.has(o.section))).map((o) => o.id));
  for (const o of objects) if (hasEnds(o) && copied.has(o.from.object) && copied.has(o.to.object)) copied.add(o.id);
  return copied;
}
export function remapEnds<T extends { type: string }>(o: T, ids: ReadonlyMap<string, string>): T {
  return hasEnds(o) ? { ...o, from: { object: ids.get(o.from.object)!, anchor: "auto" }, to: { object: ids.get(o.to.object)!, anchor: "auto" } } : o;
}
export function copiedSetReason(objects: readonly { id: string; type: string; section?: string | null }[], selected: ReadonlySet<string>): string {
  return selected.size && !copiedSet(objects, selected).size ? COPY_REASON : "";
}
export function connectReason(board: BoardV8, selected: ReadonlySet<string>, state: Parameters<typeof editingCommandReason>[0]): string {
  const reason = editingCommandReason(state);
  if (reason) return reason;
  const ideas = board.objects.filter((o) => selected.has(o.id));
  if (selected.size !== 2 || ideas.length !== 2 || !ideas.every(eligibleIdea)) return "Select exactly two ideas to connect.";
  return board.objects.length >= 250 ? "250 object limit reached" : "";
}
export function createConnector(board: BoardV8, from: string, to: string): { board: BoardV8; id: string } {
  if (from === to || [from, to].some((id) => !board.objects.some((o) => o.id === id && eligibleIdea(o)))) throw Error("Invalid connector ends");
  if (board.objects.length >= 250) throw Error("250 object limit reached");
  const type = typeWithEnds(), id = freshIdentifier(board);
  const object: ConnectorItem = { id, generation: freshIdentifier(board, [id]), type: type.type,
    text: type.initialText, ...type.defaultStyle, group: null, marks: [], section: null,
    from: { object: from, anchor: "auto" }, to: { object: to, anchor: "auto" }, order: board.objects.length };
  return { id, board: { ...board, objects: bands<ItemV8>([...board.objects, object]).map((o, order) => ({ ...o, order })) } };
}
