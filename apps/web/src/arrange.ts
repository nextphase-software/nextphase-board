// SPDX-License-Identifier: Apache-2.0
import { editingCommandReason } from "./commands.ts";
import type { DisplayObject } from "./selection.ts";

export const ARRANGE_GROUPS = [
  { label: "Align", commands: [
    "Align objects left", "Align objects centre", "Align objects right",
    "Align objects top", "Align objects middle", "Align objects bottom",
  ] },
  { label: "Distribute", commands: ["Distribute horizontally", "Distribute vertically"] },
  { label: "Order", commands: ["Bring to front", "Bring forward", "Send backward", "Send to back"] },
] as const;
export type ArrangeCommand = typeof ARRANGE_GROUPS[number]["commands"][number];
export type OrderCommand = typeof ARRANGE_GROUPS[2]["commands"][number];
export const isOrderCommand = (command: ArrangeCommand): command is OrderCommand =>
  ARRANGE_GROUPS[2].commands.some((name) => name === command);
type EditingState = Parameters<typeof editingCommandReason>[0];

function axis(objects: readonly DisplayObject[], horizontal: boolean) {
  const position = (o: DisplayObject) => horizontal ? o.x : o.y;
  const length = (o: DisplayObject) => horizontal ? o.width : o.displayHeight;
  const sorted = [...objects].sort((a, b) => position(a) - position(b) || a.order - b.order);
  const start = Math.min(...objects.map(position));
  const end = Math.max(...objects.map((o) => position(o) + length(o)));
  const total = sorted.reduce((sum, o) => sum + length(o), 0);
  return { sorted, start, end, length, free: end - start - total };
}

export function arrangeReason(command: ArrangeCommand, objects: readonly DisplayObject[], state: EditingState): string {
  const editing = editingCommandReason(state);
  if (editing) return editing;
  if (isOrderCommand(command)) return objects.length ? "" : "Select an object to duplicate or delete.";
  if (command.startsWith("Align")) return objects.length >= 2 ? "" : "Select two or more objects to align.";
  if (objects.length < 3) return "Select three or more objects to distribute.";
  const horizontal = command === "Distribute horizontally";
  return axis(objects, horizontal).free >= 0 ? "" : horizontal
    ? "The objects don't fit side by side to distribute."
    : "The objects don't fit one above another to distribute.";
}

// Search adjacent-double order only when arithmetic crosses an edge. Subtracting
// the length alone is insufficient near zero: addition can round several distinct
// positions to the same edge. Find the nearest valid double below the result.
function inside(position: number, length: number, start: number, end: number): number {
  if (position < start) return start;
  if (position + length <= end) return position;
  const bits = new DataView(new ArrayBuffer(8));
  const sign = 1n << 63n, mask = (1n << 64n) - 1n;
  const key = (value: number) => {
    bits.setFloat64(0, value);
    const raw = bits.getBigUint64(0);
    return raw & sign ? (~raw & mask) : raw | sign;
  };
  const value = (ordered: bigint) => {
    bits.setBigUint64(0, ordered & sign ? ordered & ~sign : ~ordered & mask);
    return bits.getFloat64(0);
  };
  // The box's starting edge is valid for each member by construction.
  let low = key(start), high = key(position);
  while (high - low > 1n) {
    const middle = (low + high) / 2n;
    if (value(middle) + length <= end) low = middle;
    else high = middle;
  }
  return value(low);
}

// Return positions only: measured display heights never become saved heights.
export function arrangePositions(command: Exclude<ArrangeCommand, OrderCommand>, objects: readonly DisplayObject[]) {
  const horizontal = command.endsWith("left") || command.endsWith("centre") ||
    command.endsWith("right") || command === "Distribute horizontally";
  const { sorted, start, end, length, free } = axis(objects, horizontal);
  const distribute = command.startsWith("Distribute");
  if (objects.length < (distribute ? 3 : 2) || distribute && free < 0) {
    return objects.map(({ id, x, y }) => ({ id, x, y }));
  }
  const gap = free / (objects.length - 1);
  let previous = start;
  const positions = new Map(sorted.map((o, i) => {
    let position = start;
    if (distribute) position = i ? previous + length(sorted[i - 1]) + gap : start;
    else if (command.endsWith("centre") || command.endsWith("middle")) position = start + (end - start - length(o)) / 2;
    else if (command.endsWith("right") || command.endsWith("bottom")) position = end - length(o);
    position = inside(position, length(o), start, end);
    previous = position;
    return [o.id, position];
  }));
  return objects.map(({ id, x, y }) => ({ id,
    x: horizontal ? positions.get(id)! : x, y: horizontal ? y : positions.get(id)!,
  }));
}

export function arrangeOrder<T extends { id: string; order: number }>(command: OrderCommand,
  objects: readonly T[], selected: ReadonlySet<string>): T[] {
  let ordered = [...objects];
  if (command === "Bring to front") ordered = [
    ...objects.filter((o) => !selected.has(o.id)), ...objects.filter((o) => selected.has(o.id)),
  ];
  else if (command === "Send to back") ordered = [
    ...objects.filter((o) => selected.has(o.id)), ...objects.filter((o) => !selected.has(o.id)),
  ];
  else if (command === "Bring forward") {
    for (let i = ordered.length - 2; i >= 0; i--) {
      if (selected.has(ordered[i].id) && !selected.has(ordered[i + 1].id)) {
        [ordered[i], ordered[i + 1]] = [ordered[i + 1], ordered[i]];
      }
    }
  } else {
    for (let i = 1; i < ordered.length; i++) {
      if (selected.has(ordered[i].id) && !selected.has(ordered[i - 1].id)) {
        [ordered[i], ordered[i - 1]] = [ordered[i - 1], ordered[i]];
      }
    }
  }
  return ordered.map((o, order) => o.order === order ? o : { ...o, order });
}
