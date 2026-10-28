// SPDX-License-Identifier: Apache-2.0
import { add, clamp, type BoardV8 as Board, type ItemV8 as Item } from "./document.ts";
import { arrangeOrder, type OrderCommand } from "./arrange.ts";
import { editingCommandReason } from "./commands.ts";
import { boundingBox, limitMove, type DisplayObject, type Point } from "./selection.ts";
import { containerType, isContainer, labelPrefix, hasRectangle, hasEnds, hasText, sectionIdea, orderBand } from "./objects/registry.ts";

import { bands, FOLLOW_REASON } from "./connectors.ts";

type Ordered = { id: string; type: string; order: number };
type Member = Ordered & { section?: string | null };

export function bandOrder<T extends Ordered>(objects: readonly T[]): T[] {
  return bands(objects);
}

export function orderInBands<T extends Ordered>(command: OrderCommand, objects: readonly T[], selected: ReadonlySet<string>): T[] {
  return [0, 1, 2].flatMap((band) => arrangeOrder(command, objects.filter((o) => orderBand(o) === band), selected)).map((o, order) => o.order === order ? o : { ...o, order });
}

// Normalizing an interleaved array must record every position for exact undo.
export function orderParticipants(objects: readonly Ordered[], selected: ReadonlySet<string>): string[] {
  const interleaved = bandOrder(objects).some((o, i) => o.id !== objects[i].id);
  return objects.filter((o) => interleaved || selected.has(o.id)).map((o) => o.id);
}

export function withMembers(objects: readonly Member[], selected: ReadonlySet<string>): Set<string> {
  const containers = new Set(objects.filter((o) => selected.has(o.id) && isContainer(o)).map((o) => o.id));
  return new Set(objects.filter((o) => hasRectangle(o) && (selected.has(o.id) || o.section && containers.has(o.section))).map((o) => o.id));
}

const contains = (o: { x: number; y: number; width: number; height: number }, p: Point) =>
  p.x >= o.x && p.x <= o.x + o.width && p.y >= o.y && p.y <= o.y + o.height;
const centre = (o: { x: number; y: number; width: number; height: number }): Point =>
  ({ x: o.x + o.width / 2, y: o.y + o.height / 2 });

export function sectionAt(objects: readonly Item[], point: Point): (Item & { x: number; y: number; width: number; height: number }) | undefined {
  return [...objects].reverse().filter(hasRectangle).find((o) => isContainer(o) && contains(o, point));
}

export function dropTargets(board: Board, moving: ReadonlySet<string>, newJoinsOnly = false): Map<string, string | null> {
  const carried = new Set(board.objects.filter((o) => isContainer(o) && moving.has(o.id)).map((o) => o.id));
  const ideas = board.objects.filter(sectionIdea).filter((o) => moving.has(o.id) && !carried.has(o.section!));
  return new Map(ideas.flatMap((o): [string, string | null][] => {
    const group = o.group && board.objects.filter((m) => m.group === o.group);
    const whole = group && group.every((m) => moving.has(m.id));
    const members = whole ? ideas.filter((m) => m.group === o.group) : [o];
    const box = boundingBox(members.map((m) => ({ ...m, displayHeight: m.height })))!;
    const target = sectionAt(board.objects, centre(box))?.id ?? null;
    return newJoinsOnly && (target === null || target === o.section) ? [] : [[o.id, target]];
  }));
}

export function dropped(board: Board, moving: ReadonlySet<string>): Board {
  const targets = dropTargets(board, moving);
  return { ...board, objects: board.objects.map((o) => targets.has(o.id) && o.section !== targets.get(o.id)
    ? { ...o, section: targets.get(o.id)! } : o) };
}

export function moveWithMembers(board: Board, selected: ReadonlySet<string>, dx: number, dy: number): Board {
  const ids = withMembers(board.objects, selected);
  const delta = limitMove(board.objects.filter(hasRectangle).filter((o) => ids.has(o.id)), { x: dx, y: dy });
  if (!delta.x && !delta.y) return board;
  return { ...board, objects: board.objects.map((o) => hasRectangle(o) && ids.has(o.id)
    ? { ...o, x: o.x + delta.x, y: o.y + delta.y } : o) };
}

export function assignSection(board: Board, selected: ReadonlySet<string>, section: string | null): Board {
  if (section !== null && !board.objects.some((o) => o.id === section && isContainer(o))) throw Error("Unknown section");
  const objects = board.objects.map((o) => selected.has(o.id) && sectionIdea(o) && o.section !== section ? { ...o, section } : o);
  return objects.some((o, i) => o !== board.objects[i]) ? { ...board, objects } : board;
}

export function placeObject(board: Board, object: Item): Board {
  if (!hasRectangle(object)) throw Error("An object with ends cannot be placed by a tool");
  const section = isContainer(object);
  const placed = section ? object : { ...object, section: sectionAt(board.objects, centre(object))?.id ?? null };
  const objects = bandOrder([...board.objects, placed]).map((o, order) => ({ ...o, order,
    section: section && sectionIdea(o) && contains(object, centre(o)) ? object.id : o.section,
  }));
  return { ...board, objects };
}

export function drawRectangle(start: Point, end: Point, range: { min: number; max: number } = containerType().sizeRange) {
  const width = clamp(Math.abs(end.x - start.x), range.min, range.max);
  const height = clamp(Math.abs(end.y - start.y), range.min, range.max);
  return { x: clamp(Math.min(start.x, end.x), -1e6, 1e6 - width),
    y: clamp(Math.min(start.y, end.y), -1e6, 1e6 - height), width, height };
}

type EditingState = Parameters<typeof editingCommandReason>[0];
const editable: EditingState = { readOnly: false, composing: false, pointerGesture: false, invalidObjectText: false };
export function wrapReason(board: Board, selected: ReadonlySet<string>, drawn: readonly DisplayObject[], state: EditingState = editable): string {
  const reason = editingCommandReason(state);
  if (reason) return reason;
  const objects = board.objects.filter(hasRectangle).filter((o) => selected.has(o.id));
  if (!objects.length && selected.size) return FOLLOW_REASON;
  if (!objects.length) return "Select an object to duplicate or delete.";
  if (objects.some(isContainer)) return "Sections cannot contain sections.";
  if (board.objects.length >= 250) return "250 object limit reached";
  const box = boundingBox(drawn.filter((o) => selected.has(o.id) && board.objects.some((item) => item.id === o.id && hasRectangle(item))))!;
  return box.width + 80 > containerType().sizeRange.max || box.height + 80 > containerType().sizeRange.max
    ? "The selection with its margin exceeds the 10,000-unit section limit." : "";
}

export function wrapSelection(board: Board, selected: ReadonlySet<string>, drawn: readonly DisplayObject[]): { board: Board; id: string } {
  const reason = wrapReason(board, selected, drawn);
  if (reason) throw Error(reason);
  const box = boundingBox(drawn.filter((o) => selected.has(o.id) && board.objects.some((item) => item.id === o.id && hasRectangle(item))))!;
  const rectangle = drawRectangle({ x: box.x - 40, y: box.y - 40 },
    { x: box.x + box.width + 40, y: box.y + box.height + 40 });
  const object = { ...add(board, containerType().type, 0, 0).objects.at(-1)!, ...rectangle };
  return { board: assignSection(placeObject(board, object), selected, object.id), id: object.id };
}

const shortName = (text: string) => text.slice(0, 36).replace(/\r\n|[\r\n]/g, " ") || "Empty";
export function objectLabel(board: Board, object: Item, numbers: ReadonlyMap<string, number>, drafts: Record<string, string> = {}): string {
  const container = isContainer(object);
  const peers = board.objects.filter((o) => orderBand(o) === orderBand(object));
  const prefix = labelPrefix(object) + " " + (peers.findIndex((o) => o.id === object.id) + 1);
  const text = hasText(object) ? drafts[object.id] ?? object.text : "";
  const name = container ? shortName(text) : text.slice(0, 36) || "Empty";
  if (hasEnds(object)) {
    const endpoint = (id: string) => {
      const idea = board.objects.find((o) => o.id === id)!;
      return labelPrefix(idea) + " " + (board.objects.filter(sectionIdea).findIndex((o) => o.id === id) + 1);
    };
    return prefix + " · " + shortName(text) + " · " + endpoint(object.from.object) + " to " + endpoint(object.to.object);
  }
  if (container) {
    const count = board.objects.filter((o) => o.section === object.id).length;
    return prefix + " · " + name + " · " + count + (count === 1 ? " item" : " items");
  }
  const parent = board.objects.find((o) => o.id === object.section);
  return prefix + (object.group !== null ? " · Group " + numbers.get(object.group) : "") + (hasText(object) ? " · " + name : "") +
    (parent ? " · in " + shortName(drafts[parent.id] ?? parent.text ?? "") : "");
}

export function remapSection(section: string | null | undefined, ids: ReadonlyMap<string, string>): string | null {
  return section ? ids.get(section) ?? null : null;
}
