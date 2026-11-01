// SPDX-License-Identifier: Apache-2.0
import * as Y from "yjs";
import { canonical, freshIdentifier, validate, type BoardV10, type ItemV10 } from "nextphase-board-rules/document.ts";
import { checkTransition } from "nextphase-board-rules/transition.ts";
import { hasEnds } from "nextphase-board-rules/objects/registry.ts";
import { readBoard } from "./codec.ts";

type Unit = { value: unknown; identity: string };
export type State = { board: BoardV10; units: Map<string, Map<string, Unit>> };
type Entry = { id: string; key: string; before: unknown; after: unknown; guard: string; live: boolean };
type Step = Entry[];
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const identity = (item: Y.Item | null | undefined) => item ? `${item.id.client}:${item.id.clock}` : "absent";

function textIdentity(text: Y.Text) {
  const parts: string[] = [];
  for (let item = text._start; item; item = item.right) {
    parts.push(`${identity(item)}:${item.length}:${item.deleted}`);
  }
  return parts.join("|");
}
export function capture(doc: Y.Doc): State {
  const units = new Map<string, Map<string, Unit>>();
  const board = doc.getMap("board");
  units.set("", new Map([["title", { value: board.get("title"), identity: identity(board._map.get("title")) }]]));
  for (const [id, map] of doc.getMap<Y.Map<unknown>>("objects")) {
    const values = new Map<string, Unit>();
    for (const [key, value] of map) {
      if (["generation", "type"].includes(key)) continue;
      values.set(key, { value: value instanceof Y.Text ? value.toString() : value,
        identity: value instanceof Y.Text ? textIdentity(value) : identity(map._map.get(key)) });
    }
    units.set(id, values);
  }
  return { board: readBoard(doc), units };
}
function objectGuard(state: State, id: string) {
  return JSON.stringify([...state.units.get(id) ?? []].map(([key, unit]) => [key, unit.identity]));
}
function stepBetween(before: State, after: State): Step {
  const step: Step = [];
  const ids = new Set([...before.units.keys(), ...after.units.keys()]);
  for (const id of ids) {
    const old = before.units.get(id), next = after.units.get(id);
    if (!old || !next) {
      step.push({ id, key: "object", before: before.board.objects.find((o) => o.id === id) ?? null,
        after: after.board.objects.find((o) => o.id === id) ?? null, guard: objectGuard(after, id), live: true });
      continue;
    }
    for (const [key, unit] of next) if (!equal(old.get(key)?.value, unit.value)) {
      step.push({ id, key, before: old.get(key)?.value, after: unit.value, guard: unit.identity, live: true });
    }
  }
  return step;
}
function applyUnit(object: ItemV10, key: string, value: unknown): ItemV10 {
  return ["geometry", "style", "ends", "connectorStyle"].includes(key)
    ? { ...object, ...value as object } : { ...object, [key]: value };
}
function remapObject(object: ItemV10, ids: Map<string, { id: string; generation: string }>): ItemV10 {
  return { ...object, ...ids.get(object.id),
    ...(hasEnds(object) ? { from: { ...object.from, object: ids.get(object.from.object)?.id ?? object.from.object },
      to: { ...object.to, object: ids.get(object.to.object)?.id ?? object.to.object } } : {}),
    section: object.section ? ids.get(object.section)?.id ?? object.section : null };
}

// A history belongs to one connection. It observes assignment identities, not
// just values: another writer assigning the same value kills a guard forever.
export class SharedUndo {
  past: Step[] = [];
  future: Step[] = [];
  clear() { this.past = []; this.future = []; }
  observe(before: State, after: State, own: boolean) {
    for (const step of [...this.past, ...this.future]) for (const entry of step) {
      if (!entry.live) continue;
      if (entry.key === "object") {
        if (!own && objectGuard(before, entry.id) !== objectGuard(after, entry.id)) entry.live = false;
        else if (own) entry.guard = objectGuard(after, entry.id);
      } else {
        const old = before.units.get(entry.id)?.get(entry.key);
        const current = after.units.get(entry.id)?.get(entry.key);
        if (!own && old?.identity !== current?.identity) entry.live = false;
        else if (own && current && equal(entry.after, current.value)) entry.guard = current.identity;
      }
    }
  }
  record(before: State, after: State, direction?: "undo" | "redo") {
    this.observe(before, after, true);
    const step = stepBetween(before, after);
    if (!step.length) return;
    if (direction === "undo") this.future.push(step);
    else {
      this.past.push(step); this.past = this.past.slice(-100);
      if (!direction) this.future = [];
    }
  }
  take(state: State, direction: "undo" | "redo"): BoardV10 | string {
    const step = (direction === "undo" ? this.past : this.future).pop();
    if (!step) return "nothing_to_undo";
    const eligible = step.filter((entry) => entry.live && (entry.key === "object"
      ? entry.guard === objectGuard(state, entry.id)
      : entry.guard === state.units.get(entry.id)?.get(entry.key)?.identity));
    if (!eligible.length) return "changed_by_others";
    let board = { ...state.board, objects: [...state.board.objects], retiredGenerations: [...state.board.retiredGenerations] };
    const restored = new Map<string, { id: string; generation: string }>();
    const reserved: string[] = [];
    for (const entry of eligible) if (entry.key === "object" && entry.before && !entry.after) {
      const id = freshIdentifier(board, reserved); reserved.push(id);
      const generation = freshIdentifier(board, reserved); reserved.push(generation);
      restored.set(entry.id, { id, generation });
    }
    for (const entry of eligible) {
      if (entry.key !== "object") {
        if (entry.id === "") board.title = entry.before as string;
        else board.objects = board.objects.map((object) => object.id === entry.id ? applyUnit(object, entry.key, entry.before) : object);
      } else if (entry.after && !entry.before) {
        const object = board.objects.find((o) => o.id === entry.id);
        if (object) board.retiredGenerations.push(object.generation);
        board.objects = board.objects.filter((o) => o.id !== entry.id);
      } else if (entry.before && !entry.after) {
        const object = remapObject(entry.before as ItemV10, restored);
        const live = new Set([...board.objects.map((o) => o.id), ...[...restored.values()].map((o) => o.id)]);
        if (hasEnds(object) && (!live.has(object.from.object) || !live.has(object.to.object))) continue;
        if (object.section && !live.has(object.section)) object.section = null;
        board.objects.splice(Math.min(object.order, board.objects.length), 0, object);
      }
    }
    board = { ...board, objects: board.objects.map((object, order) => ({ ...object, order })),
      retiredGenerations: [...new Set(board.retiredGenerations)].sort() };
    try { validate(board); canonical(board); checkTransition(state.board, board); }
    catch { return "undo_invalid"; }
    if (equal(board, state.board)) return "changed_by_others";
    // Only successful restoration retargets the connection's older steps.
    for (const older of [...this.past, ...this.future]) for (const entry of older) {
      const replacement = restored.get(entry.id);
      if (entry.key === "object") {
        if (entry.before) entry.before = remapObject(entry.before as ItemV10, restored);
        if (entry.after) entry.after = remapObject(entry.after as ItemV10, restored);
      } else if (entry.key === "section") {
        entry.before = restored.get(entry.before as string)?.id ?? entry.before;
        entry.after = restored.get(entry.after as string)?.id ?? entry.after;
      } else if (entry.key === "ends") {
        const remap = (value: any) => ({ from: { ...value.from, object: restored.get(value.from.object)?.id ?? value.from.object },
          to: { ...value.to, object: restored.get(value.to.object)?.id ?? value.to.object } });
        entry.before = remap(entry.before); entry.after = remap(entry.after);
      }
      if (replacement) entry.id = replacement.id;
    }
    return board;
  }
}
