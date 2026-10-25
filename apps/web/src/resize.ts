// SPDX-License-Identifier: Apache-2.0
export type Corner = "nw" | "ne" | "sw" | "se";
export type Rectangle = { x: number; y: number; width: number; height: number };
type Delta = { x: number; y: number };
export type ResizeMember = Rectangle & { neededHeight: (width: number) => number };
type Range = { min: number; max: number };
const clamp = (value: number, range: Range) => Math.max(range.min, Math.min(range.max, value));
const west = (corner: Corner) => corner === "nw" || corner === "sw";
const north = (corner: Corner) => corner === "nw" || corner === "ne";

function dominant(x: number, y: number): number {
  if (x >= 1 && y >= 1) return Math.max(x, y);
  if (x <= 1 && y <= 1) return Math.min(x, y);
  return x + y >= 2 ? Math.max(x, y) : Math.min(x, y);
}

// A boundary quotient can multiply back just outside a hard limit (e.g. 2000/123).
// Move only the shared scale to its next representable value toward 1; geometry
// itself is never rounded, and all members still use exactly the same scale.
function boundedScale(value: number, range: Range, valid: (scale: number) => boolean): number {
  let scale = clamp(value, range);
  const bits = new DataView(new ArrayBuffer(8));
  while (scale !== 1 && !valid(scale)) {
    bits.setFloat64(0, scale);
    bits.setBigUint64(0, bits.getBigUint64(0) + (scale > 1 ? -1n : 1n));
    scale = bits.getFloat64(0);
  }
  return scale;
}

function axisValid(start: number, length: number, fixed: number, minimum: number, scale: number) {
  const position = scale === 1 ? start : fixed + (start - fixed) * scale;
  const size = length * scale;
  return size >= minimum && size <= 2000 && position >= -1e6 && position + size <= 1e6;
}

// Positive scales keep each edge between the board edges about a fixed origin.
function axisRange(start: number, length: number, fixed: number, minimum: number): Range {
  let max = 2000 / length;
  for (const edge of [start, start + length]) {
    const distance = edge - fixed;
    if (distance > 0) max = Math.min(max, (1e6 - fixed) / distance);
    if (distance < 0) max = Math.min(max, (-1e6 - fixed) / distance);
  }
  return { min: minimum / length, max };
}

function scales(corner: Corner, bounds: Rectangle, delta: Delta, shift: boolean,
  horizontal: Range, vertical: Range, validX: (scale: number) => boolean,
  validY: (scale: number) => boolean) {
  const x = 1 + (west(corner) ? -delta.x : delta.x) / bounds.width;
  const y = 1 + (north(corner) ? -delta.y : delta.y) / bounds.height;
  if (!shift) return { x: boundedScale(x, horizontal, validX), y: boundedScale(y, vertical, validY) };
  const scale = boundedScale(dominant(x, y), {
    min: Math.max(horizontal.min, vertical.min), max: Math.min(horizontal.max, vertical.max),
  }, (s) => validX(s) && validY(s));
  return { x: scale, y: scale };
}

export function resizeObject(corner: Corner, start: Rectangle, delta: Delta, shift: boolean,
  neededHeight: (width: number) => number): Rectangle {
  if (delta.x === 0 && delta.y === 0) return { ...start };
  const fx = start.x + (west(corner) ? start.width : 0);
  const fy = start.y + (north(corner) ? start.height : 0);
  const widthRange = { min: Math.min(80, start.width),
    max: Math.min(2000, west(corner) ? fx + 1e6 : 1e6 - fx) };
  const heightRange = { min: 40,
    max: Math.min(2000, north(corner) ? fy + 1e6 : 1e6 - fy) };
  const rawWidth = start.width + (west(corner) ? -delta.x : delta.x);
  const rawHeight = start.height + (north(corner) ? -delta.y : delta.y);
  let width = clamp(rawWidth, widthRange), height = clamp(rawHeight, heightRange);
  if (shift) {
    const scale = boundedScale(dominant(rawWidth / start.width, rawHeight / start.height), {
      min: Math.max(widthRange.min / start.width, heightRange.min / start.height),
      max: Math.min(widthRange.max / start.width, heightRange.max / start.height),
    }, (s) => {
      const w = start.width * s, h = start.height * s;
      const x = west(corner) ? fx - w : start.x, y = north(corner) ? fy - h : start.y;
      return w >= widthRange.min && w <= widthRange.max && h >= heightRange.min &&
        h <= heightRange.max && x >= -1e6 && x + w <= 1e6 && y >= -1e6 && y + h <= 1e6;
    });
    width = start.width * scale;
    height = start.height * scale;
  }
  const text = Math.min(2000, neededHeight(width));
  let y = start.y;
  if (north(corner)) {
    height = Math.max(height, text);
    y = Math.max(-1e6, fy - height);
  } else height = Math.max(height, Math.min(text, 2000, 1e6 - y));
  return { x: west(corner) ? fx - width : start.x, y, width, height };
}

export function resizeSet(corner: Corner, members: readonly ResizeMember[], delta: Delta,
  shift: boolean): Rectangle[] {
  const rectangles = members.map(({ x, y, width, height }) => ({ x, y, width, height }));
  if (!members.length || delta.x === 0 && delta.y === 0) return rectangles;
  const x = Math.min(...members.map((o) => o.x)), y = Math.min(...members.map((o) => o.y));
  const bounds = { x, y,
    width: Math.max(...members.map((o) => o.x + o.width)) - x,
    height: Math.max(...members.map((o) => o.y + o.height)) - y };
  const fx = x + (west(corner) ? bounds.width : 0);
  const fy = y + (north(corner) ? bounds.height : 0);
  const overlap = (ranges: Range[]): Range => ({
    min: Math.max(...ranges.map((r) => r.min)), max: Math.min(...ranges.map((r) => r.max)),
  });
  const scale = scales(corner, bounds, delta, shift,
    overlap(members.map((o) => axisRange(o.x, o.width, fx, Math.min(80, o.width)))),
    overlap(members.map((o) => axisRange(o.y, o.height, fy, 40))),
    (s) => members.every((o) => axisValid(o.x, o.width, fx, Math.min(80, o.width), s)),
    (s) => members.every((o) => axisValid(o.y, o.height, fy, 40, s)));
  return members.map((o) => {
    const x = scale.x === 1 ? o.x : fx + (o.x - fx) * scale.x;
    const y = scale.y === 1 ? o.y : fy + (o.y - fy) * scale.y;
    const width = o.width * scale.x;
    return { x, y, width,
      height: Math.max(o.height * scale.y, Math.min(o.neededHeight(width), 2000, 1e6 - y)) };
  });
}

export function cornerPoint(corner: Corner, rectangle: Rectangle) {
  return {
    x: rectangle.x + (corner.endsWith("e") ? rectangle.width : 0),
    y: rectangle.y + (corner.startsWith("s") ? rectangle.height : 0),
  };
}
