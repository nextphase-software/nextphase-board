// SPDX-License-Identifier: Apache-2.0
import type { Point } from "./selection.ts";

export type Segment = { points: Point[] };
export type ConnectorPath = { path: string; samples: Point[]; extrema: Point[]; segments: Segment[] };
const mix = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
export function curvePoint(points: readonly Point[], t: number): Point {
  return points.length === 1 ? points[0] : curvePoint(points.slice(1).map((p, i) => mix(points[i], p, t)), t);
}
export function splitCurve(points: readonly Point[], t: number): [Point[], Point[]] {
  const left = [points[0]], right = [points.at(-1)!];
  let row = [...points];
  while (row.length > 1) { row = row.slice(1).map((p, i) => mix(row[i], p, t)); left.push(row[0]); right.unshift(row.at(-1)!); }
  return [left, right];
}
export function pathFromSegments(segments: Segment[]): ConnectorPath {
  const samples: Point[] = segments.length ? [segments[0].points[0]] : [], extrema = [...samples];
  let path = samples.length ? `M ${samples[0].x} ${samples[0].y}` : "";
  for (const { points } of segments) {
    path += " " + ({ 2: "L", 3: "Q", 4: "C" }[points.length] ?? "L") + " " + points.slice(1).map((p) => `${p.x} ${p.y}`).join(" ");
    const steps = points.length === 4 ? 256 : points.length === 3 ? 16 : 1;
    for (let i = 1; i <= steps; i++) samples.push(curvePoint(points, i / steps));
    extrema.push(points[0], points.at(-1)!);
    for (const axis of ["x", "y"] as const) {
      const [a, b, c, d] = points.map((p) => p[axis]);
      const roots: number[] = [];
      if (points.length === 3) roots.push((a - b) / (a - 2 * b + c));
      if (points.length === 4) {
        const A = -a + 3 * b - 3 * c + d, B = 2 * (a - 2 * b + c), C = b - a;
        if (Math.abs(A) < 1e-12) roots.push(-C / B);
        else { const disc = B * B - 4 * A * C; if (disc >= 0) roots.push((-B + Math.sqrt(disc)) / (2 * A), (-B - Math.sqrt(disc)) / (2 * A)); }
      }
      for (const t of roots) if (t > 0 && t < 1) extrema.push(curvePoint(points, t));
    }
  }
  return { path, samples, extrema, segments };
}
export function curvedPath(a: Point, b: Point, n: Point, m: Point): ConnectorPath {
  const reach = Math.max(24, distance(a, b) / 2);
  return pathFromSegments([{ points: [a, { x: a.x + reach * n.x, y: a.y + reach * n.y },
    { x: b.x + reach * m.x, y: b.y + reach * m.y }, b] }]);
}
export function straightPath(a: Point, b: Point): ConnectorPath { return pathFromSegments([{ points: [a, b] }]); }
function lengthTable(points: Point[]) {
  const steps = points.length === 2 ? 1 : points.length === 3 ? 16 : 256;
  const lengths = [0];
  for (let i = 1; i <= steps; i++) lengths.push(lengths[i - 1] + distance(curvePoint(points, (i - 1) / steps), curvePoint(points, i / steps)));
  return lengths;
}
function parameter(lengths: number[], length: number) {
  const i = lengths.findIndex((v) => v >= length);
  if (i <= 0) return i === 0 ? 0 : 1;
  const span = lengths[i] - lengths[i - 1];
  return (i - 1 + (span ? (length - lengths[i - 1]) / span : 0)) / (lengths.length - 1);
}
// Lengths use the prescribed samples; subdivision retains the exact original
// quadratic/cubic, rather than replacing a shortened curve with a polyline.
export function shortenPath(input: ConnectorPath, from: number, to: number): ConnectorPath {
  if (!from && !to) return input;
  const tables = input.segments.map((s) => lengthTable(s.points));
  const lengths = tables.map((t) => t.at(-1)!), total = lengths.reduce((a, b) => a + b, 0);
  const factor = from + to > total ? total / (from + to) : 1;
  const start = from * factor, end = Math.max(start, total - to * factor);
  let position = 0;
  const segments: Segment[] = [];
  input.segments.forEach((s, i) => {
    const next = position + lengths[i];
    if (next >= start && position <= end) {
      const a = parameter(tables[i], Math.max(0, start - position)), b = parameter(tables[i], Math.min(lengths[i], end - position));
      if (b >= a) {
        const left = splitCurve(s.points, b)[0];
        segments.push({ points: b ? splitCurve(left, a / b)[1] : left });
      }
    }
    position = next;
  });
  return pathFromSegments(segments);
}

export function readPath(path: string): ConnectorPath {
  const tokens = path.split(/\s+/), segments: Segment[] = [];
  let point = { x: 0, y: 0 };
  for (let i = 0; i < tokens.length;) {
    const command = tokens[i++], count = command === "M" || command === "L" ? 1 : command === "Q" ? 2 : 3;
    const points = [point];
    for (let j = 0; j < count; j++) points.push({ x: Number(tokens[i++]), y: Number(tokens[i++]) });
    if (command !== "M") segments.push({ points });
    point = points.at(-1)!;
  }
  return pathFromSegments(segments);
}
