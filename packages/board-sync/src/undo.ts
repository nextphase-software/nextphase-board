// SPDX-License-Identifier: Apache-2.0
import * as Y from "yjs";
import { canonical, freshIdentifier, validate, type BoardV14, type ItemV14 } from "nextphase-board-rules/document.ts";
import { checkTransition } from "nextphase-board-rules/transition.ts";
import { hasEnds, isMindNode, isTable, sizeTable, setCell, type TableAxis } from "nextphase-board-rules/objects/registry.ts";
import { readBoard } from "./codec.ts";

import type { TableItem } from "nextphase-board-rules/document.ts";
import type { TableOrderHint } from "./document-adapter.ts";
import { compareKeys } from "./order-keys.ts";
type Unit = { value: unknown; identity: string };
export type State = { board: BoardV14; units: Map<string, Map<string, Unit>> };
type Entry = { id: string; key: string; before: unknown; after: unknown; guard: string; live: boolean };
type Step = Entry[] & { page?: string; table?: string; tableIdentities?: Map<string, string> };
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
  const pages = board.get("pageMap") as Y.Map<Y.Map<unknown>>;
  for (const [id, map] of pages) {
    units.set(`page:${id}`, new Map([...map].map(([key, value]) => [key, { value, identity: identity(map._map.get(key)) }])));
  }
  for (const [id, map] of doc.getMap<Y.Map<unknown>>("objects")) {
    const values = new Map<string, Unit>();
    const table = isTable({ type: String(map.get("type")) });
    if (table) {
      values.set("tableIdentity", { value: id, identity: identity(map._item) });
      const rows = captureAxis(map, values, "row", "height"), columns = captureAxis(map, values, "column", "width");
      const cells = map.get("cells") as Y.Map<Y.Text>;
      for (const [key, text] of cells) {
        const [row, column] = key.split(":");
        if (rows.has(row) && columns.has(column)) values.set("cell:" + key, { value: text.toString(),
          identity: identity(cells._map.get(key)) + "|" + textIdentity(text) });
      }
    }
    for (const [key, value] of map) {
      if (table && ["columnMap", "rowMap", "cells"].includes(key)) continue;
      if (["generation", "type"].includes(key)) continue;
      const snapshot = table && (key === "place" || key === "tableStyle") ? structuredClone(value) : value;
      values.set(key, { value: value instanceof Y.Text ? value.toString() : snapshot,
        identity: value instanceof Y.Text ? textIdentity(value) : identity(map._map.get(key)) });
    }
    units.set(id, values);
  }
  return { board: readBoard(doc), units };
}
function captureAxis(map: Y.Map<unknown>, values: Map<string, Unit>, axis: TableAxis, size: "width" | "height") {
  const entries = map.get(axis + "Map") as Y.Map<Y.Map<unknown>>;
  for (const [id, entry] of entries) values.set(axis + ":" + id, {
    value: { order: entry.get("order"), size: entry.get(size) },
    identity: [entry._item, entry._map.get("order"), entry._map.get(size)].map(identity).join("|"),
  });
  return entries;
}
const absent: Unit = { value: undefined, identity: "absent" };
const unitAt = (state: State, id: string, key: string) => state.units.get(id)?.get(key) ?? absent;

function objectGuard(state: State, id: string) {
  return JSON.stringify([...state.units.get(id) ?? []].map(([key, unit]) => [key, unit.identity]));
}
function stepBetween(before: State, after: State): Step {
  const step: Step = [];
  const ids = new Set([...before.units.keys(), ...after.units.keys()]);
  for (const id of ids) {
    const old = before.units.get(id), next = after.units.get(id);
    if (!old || !next) {
      step.push({ id, key: "object", before: id.startsWith("page:") ? old ? Object.fromEntries([...old].map(([key, unit]) => [key, unit.value])) : null : before.board.objects.find((o) => o.id === id) ?? null,
        after: id.startsWith("page:") ? next ? Object.fromEntries([...next].map(([key, unit]) => [key, unit.value])) : null : after.board.objects.find((o) => o.id === id) ?? null, guard: objectGuard(after, id), live: true });
      continue;
    }
    const table = next.has("tableIdentity");
    const keys = table ? new Set([...old.keys(), ...next.keys()]) : next.keys();
    for (const key of keys) {
      const previous = old.get(key) ?? absent, current = next.get(key) ?? absent;
      if (!equal(previous.value, current.value) || table && previous.identity !== current.identity)
        step.push({ id, key, before: previous.value, after: current.value, guard: current.identity, live: true });
    }
  }
  for (const entry of step) if (entry.key !== "object" && after.units.get(entry.id)?.has("tableIdentity")) {
    (step.tableIdentities ??= new Map()).set(entry.id, unitAt(after, entry.id, "tableIdentity").identity);
  }
  const target = step[0]?.id;
  if (target && step.tableIdentities?.has(target) && step.every(entry => entry.id === target)) step.table = target;
  return step;
}
function applyUnit(object: ItemV14, key: string, value: unknown): ItemV14 {
  return ["geometry", "style", "ends", "connectorStyle", "place", "tableStyle"].includes(key)
    ? { ...object, ...value as object } : { ...object, [key]: value };
}
function remapObject(object: ItemV14, ids: Map<string, { id: string; generation: string }>): ItemV14 {
  return { ...object, ...ids.get(object.id),
    ...(hasEnds(object) ? { from: { ...object.from, object: ids.get(object.from.object)?.id ?? object.from.object },
      to: { ...object.to, object: ids.get(object.to.object)?.id ?? object.to.object } } : {}),
    ...(isMindNode(object) ? { parent: remapId(object.parent, ids) } : {}),
    section: object.section ? ids.get(object.section)?.id ?? object.section : null };
}
const remapId = (value: unknown, ids: Map<string, { id: string; generation: string }>) =>
  typeof value === "string" ? ids.get(value)?.id ?? value : value as string | null;

function restoreTable(table: TableItem, step: Step, state: State): { table: TableItem; hint: TableOrderHint } | undefined {
  const orders: NonNullable<TableOrderHint["orders"]> = {};
  const restoreAxis = (axis: TableAxis, current: { id: string }[]) => {
    const values = new Map(current.map(({ id }) => [id, unitAt(state, table.id, axis + ":" + id).value as { order: string; size: number }]));
    const restored = new Map<string, string>();
    for (const entry of step.filter(entry => entry.key.startsWith(axis + ":"))) {
      const id = entry.key.slice(axis.length + 1);
      if (entry.before === undefined) values.delete(id);
      else {
        const value = entry.before as { order: string; size: number };
        values.set(id, value);
        restored.set(id, value.order);
      }
    }
    orders[axis] = restored;
    return [...values].sort(([a, x], [b, y]) => compareKeys(x.order, y.order) || compareKeys(a, b));
  };
  const rows = restoreAxis("row", table.rows).map(([id, value]) => ({ id, height: value.size }));
  const columns = restoreAxis("column", table.columns).map(([id, value]) => ({ id, width: value.size }));
  const keys = new Set(step.map(entry => entry.key));
  if (table.cells.some(c => (!rows.some(r => r.id === c.row) || !columns.some(col => col.id === c.column)) &&
    !keys.has("cell:" + c.row + ":" + c.column))) return;
  const replaceCells = new Set<string>();
  let next = sizeTable({ ...table, rows, columns, cells: table.cells.filter(c =>
    rows.some(r => r.id === c.row) && columns.some(col => col.id === c.column)) });
  for (const entry of step) {
    if (entry.key.startsWith("cell:")) {
      const key = entry.key.slice(5), [row, column] = key.split(":");
      if (entry.before === undefined) continue;
      if (!rows.some(r => r.id === row) || !columns.some(c => c.id === column)) return;
      if (entry.after === undefined) replaceCells.add(key);
      next = setCell(next, { row, column }, entry.before as string);
    } else if (!entry.key.startsWith("row:") && !entry.key.startsWith("column:")) next = applyUnit(next, entry.key, entry.before) as TableItem;
  }
  return { table: next, hint: { table: table.id, orders, replaceCells } };
}

// A history belongs to one connection. It observes assignment identities, not
// just values: another writer assigning the same value kills a guard forever.
export class SharedUndo {
  past: Step[] = [];
  future: Step[] = [];
  private group?: string;
  page?: string;
  tableHint?: TableOrderHint;
  table?: string;
  pageOrders = new Map<string, string>();
  clear() { this.past = []; this.future = []; this.group = undefined; }
  observe(before: State, after: State, own: boolean) {
    for (const step of [...this.past, ...this.future]) {
      if (own) for (const id of step.tableIdentities?.keys() ?? []) {
        if (!before.units.has(id) && after.units.has(id)) step.tableIdentities!.set(id, unitAt(after, id, "tableIdentity").identity);
      }
      for (const entry of step) {
        if (!entry.live) continue;
        if (entry.key === "object") {
          if (!own && objectGuard(before, entry.id) !== objectGuard(after, entry.id)) entry.live = false;
          else if (own) entry.guard = objectGuard(after, entry.id);
        } else {
          const old = unitAt(before, entry.id, entry.key);
          const current = unitAt(after, entry.id, entry.key);
          if (!own && old.identity !== current.identity) entry.live = false;
          else if (own && equal(entry.after, current.value)) entry.guard = current.identity;
        }
      }
    }
  }
  record(before: State, after: State, direction?: "undo" | "redo", group?: string, page?: string) {
    this.observe(before, after, true);
    const step = stepBetween(before, after); step.page = page;
    if (!step.length) return;
    const previous = this.past.at(-1);
    const unitOnly = !step.some((entry) => entry.key === "object");
    if (!direction && group && group === this.group && previous && unitOnly) {
      // Keep the first before-value and never revive a guard killed by a peer.
      for (const entry of step) {
        const old = previous.find((value) => value.id === entry.id && value.key === entry.key);
        if (old) { old.after = entry.after; old.guard = entry.guard; }
        else previous.push(entry);
      }
      this.future = [];
      return;
    }
    // The add of a mind node carries its first text session's group, so the text
    // and the layout written when that session ends join this step.
    const addsNode = step.every((entry) => entry.key !== "object" || !entry.before) &&
      step.some((entry) => entry.key === "object" && !entry.id.startsWith("page:") && !entry.before && isMindNode(entry.after as ItemV14));
    this.group = !direction && (unitOnly || addsNode) && group ? group : undefined;
    if (direction === "undo") this.future.push(step);
    else {
      this.past.push(step); this.past = this.past.slice(-100);
      if (!direction) this.future = [];
    }
  }
  take(state: State, direction: "undo" | "redo"): BoardV14 | string {
    this.group = undefined; this.pageOrders.clear(); this.page = undefined; this.tableHint = undefined; this.table = undefined;
    const step = (direction === "undo" ? this.past : this.future).pop();
    if (!step) return "nothing_to_undo";
    const wholeTable = step.length === 1 && step[0].key === "object"
      && [step[0].before, step[0].after].some(o => !!o && isTable(o as ItemV14)) ? step[0].id : undefined;
    this.page = step.page; this.table = step.table ?? wholeTable;
    const eligible = step.filter((entry) => entry.live && (entry.key === "object"
      ? entry.guard === objectGuard(state, entry.id)
      : entry.guard === unitAt(state, entry.id, entry.key).identity));
    if (!eligible.length) return "changed_by_others";
    let board = { ...state.board, pages: [...state.board.pages], objects: [...state.board.objects], retiredGenerations: [...state.board.retiredGenerations] };
    const restored = new Map<string, { id: string; generation: string }>();
    const reserved: string[] = [];
    for (const entry of eligible) if (entry.key === "object" && !entry.id.startsWith("page:") && entry.before && !entry.after) {
      const id = freshIdentifier(board, reserved); reserved.push(id);
      const generation = freshIdentifier(board, reserved); reserved.push(generation);
      restored.set(entry.id, { id, generation });
    }
    if (wholeTable) this.table = restored.get(wholeTable)?.id ?? wholeTable;
    const pageValues = new Map(state.board.pages.map(p => [p.id, { name: p.name, order: state.units.get(`page:${p.id}`)!.get("order")!.value as string }]));
    for (const [id, identity] of step.tableIdentities ?? []) {
      const table = board.objects.find(o => o.id === id);
      const units = step.filter(entry => entry.id === id);
      const result = table && isTable(table) && units.every(entry => eligible.includes(entry)) &&
        identity === unitAt(state, id, "tableIdentity").identity ? restoreTable(table, units, state) : undefined;
      if (result) {
        if (step.table) this.tableHint = result.hint;
        board.objects = board.objects.map(o => o.id === id ? result.table : o);
      } else if (step.table) return "changed_by_others";
    }
    for (const entry of eligible) {
      if (step.tableIdentities?.has(entry.id)) continue;
      if (entry.id.startsWith("page:")) {
        const id = entry.id.slice(5);
        if (entry.key === "object") {
          if (entry.before) { pageValues.set(id, { ...entry.before as { name: string; order: string } }); this.pageOrders.set(id, pageValues.get(id)!.order); }
          else pageValues.delete(id);
        } else {
          const value = pageValues.get(id);
          if (value) { Object.assign(value, { [entry.key]: entry.before }); if (entry.key === "order") this.pageOrders.set(id, value.order); }
        }
      } else if (entry.key !== "object") {
        if (entry.id === "") board.title = entry.before as string;
        else board.objects = board.objects.map((object) => object.id === entry.id
          ? applyUnit(object, entry.key, entry.key === "parent" ? remapId(entry.before, restored) : entry.before) : object);
      } else if (entry.after && !entry.before) {
        const object = board.objects.find((o) => o.id === entry.id);
        if (object) board.retiredGenerations.push(object.generation);
        board.objects = board.objects.filter((o) => o.id !== entry.id);
      } else if (entry.before && !entry.after) {
        const object = remapObject(entry.before as ItemV14, restored);
        const live = new Set([...board.objects.map((o) => o.id), ...[...restored.values()].map((o) => o.id)]);
        if (hasEnds(object) && (!live.has(object.from.object) || !live.has(object.to.object))) continue;
        if (object.section && !live.has(object.section)) object.section = null;
        if (isMindNode(object) && object.parent !== null && !live.has(object.parent)) Object.assign(object, { parent: null, side: null, collapsed: false });
        board.objects.splice(Math.min(object.order, board.objects.length), 0, object);
      }
    }
    board.pages = [...pageValues].sort(([a, x], [b, y]) => x.order < y.order ? -1 : x.order > y.order ? 1 : a < b ? -1 : a > b ? 1 : 0).map(([id, p]) => ({ id, name: p.name }));
    board = { ...board, objects: board.objects.map((object, order) => ({ ...object, order })),
      retiredGenerations: [...new Set(board.retiredGenerations)].sort() };
    try { validate(board); canonical(board); checkTransition(state.board, board); }
    catch { return "undo_invalid"; }
    if (equal(board, state.board)) return "changed_by_others";
    // Only successful restoration retargets the connection's older steps.
    for (const older of [...this.past, ...this.future]) for (const entry of older) {
      const replacement = restored.get(entry.id);
      if (entry.key === "object" && !entry.id.startsWith("page:")) {
        if (entry.before) entry.before = remapObject(entry.before as ItemV14, restored);
        if (entry.after) entry.after = remapObject(entry.after as ItemV14, restored);
      } else if (entry.key === "section" || entry.key === "parent") {
        entry.before = restored.get(entry.before as string)?.id ?? entry.before;
        entry.after = restored.get(entry.after as string)?.id ?? entry.after;
      } else if (entry.key === "ends") {
        const remap = (value: any) => ({ from: { ...value.from, object: restored.get(value.from.object)?.id ?? value.from.object },
          to: { ...value.to, object: restored.get(value.to.object)?.id ?? value.to.object } });
        entry.before = remap(entry.before); entry.after = remap(entry.after);
      }
      if (replacement) {
        if (older.table === entry.id) older.table = replacement.id;
        const guard = older.tableIdentities?.get(entry.id);
        if (guard) {
          older.tableIdentities!.delete(entry.id);
          older.tableIdentities!.set(replacement.id, guard);
        }
        entry.id = replacement.id;
      }
    }
    return board;
  }
}
