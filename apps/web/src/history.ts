// SPDX-License-Identifier: Apache-2.0
import type { Board, Item } from "./document.ts";

type ObjectChange = { before: Item | null; after: Item | null };
export type Step = { changes: ObjectChange[] };
export type History = { past: Step[]; future: Step[] };
export type Change = { board: Board; history: History; affectedId: string; affectedIds: string[] };
export const emptyHistory = (): History => ({ past: [], future: [] });

// Only object transactions enter history. Title, view and storage are independent.
export function record(history: History, before: Board, after: Board): History {
  const ids = new Set([...before.objects, ...after.objects].map((o) => o.id));
  const changed = [...ids].filter((id) => {
    const a = before.objects.find((o) => o.id === id);
    const b = after.objects.find((o) => o.id === id);
    // Removing an object also renumbers following objects; that is not another step.
    return JSON.stringify(a && { ...a, order: 0 }) !==
      JSON.stringify(b && { ...b, order: 0 });
  });
  if (!changed.length) return history;
  const step = { changes: changed.map((id) => ({
    before: before.objects.find((o) => o.id === id) ?? null,
    after: after.objects.find((o) => o.id === id) ?? null,
  })) };
  return { past: [...history.past, structuredClone(step)].slice(-100), future: [] };
}

function fresh(board: Board, extra: string[] = []): string {
  const used = new Set([
    board.boardId, ...board.retiredGenerations, ...extra,
    ...board.objects.flatMap((o) => [o.id, o.generation]),
  ]);
  let id: string;
  do id = crypto.randomUUID(); while (used.has(id));
  return id;
}

function apply(board: Board, changes: { source: Item | null; target: Item | null }[]): Board {
  const current = new Map(board.objects.map((o) => [o.id, o]));
  for (const { source, target } of changes) {
    const object = current.get((source ?? target)!.id);
    if (source ? !object || object.generation !== source.generation : !!object) {
      throw Error("This object incarnation is no longer active.");
    }
  }
  const removed = changes.filter((c) => c.source && !c.target);
  const added = changes.filter((c) => !c.source && c.target);
  if (board.retiredGenerations.length + removed.length > 10000) {
    throw Error("10,000 retired-generation limit reached; this command cannot remove an object.");
  }
  if (board.objects.length - removed.length + added.length > 250) {
    throw Error("250 object limit reached");
  }
  const retiredGenerations = removed.length
    ? [...board.retiredGenerations, ...removed.map((c) => c.source!.generation)].sort()
    : board.retiredGenerations;
  const ids = new Set(changes.map((c) => (c.source ?? c.target)!.id));
  const objects = board.objects.filter((o) => !ids.has(o.id));
  const reserved = changes.flatMap((c) => c.target ? [c.target.id, c.target.generation] : []);
  for (const { target } of changes.filter((c) => c.target).sort((a, b) => a.target!.order - b.target!.order)) {
    const generation = current.get(target!.id)?.generation ?? fresh(board, reserved);
    reserved.push(generation);
    objects.splice(target!.order, 0, { ...target!, generation });
  }
  return { ...board, retiredGenerations, objects: objects.map((o, order) => ({ ...o, order })) };
}

// Resurrection creates a new incarnation for this session's remaining steps.
// External commands holding an old history/target still fail the generation check.
function retarget(history: History, board: Board, ids: string[]): History {
  const generations = new Map(board.objects.filter((o) => ids.includes(o.id)).map((o) => [o.id, o.generation]));
  const item = (value: Item | null) => value && generations.has(value.id)
    ? { ...value, generation: generations.get(value.id)! } : value;
  const steps = (list: Step[]) => list.map((step) => ({
    changes: step.changes.map((c) => ({ before: item(c.before), after: item(c.after) })),
  }));
  return { past: steps(history.past), future: steps(history.future) };
}

export function undo(board: Board, history: History): Change {
  const step = history.past.at(-1);
  if (!step) throw Error("Nothing to undo.");
  const affectedIds = step.changes.map((c) => (c.before ?? c.after)!.id);
  const next = apply(board, step.changes.map((c) => ({ source: c.after, target: c.before })));
  return {
    board: next, affectedId: affectedIds[0], affectedIds,
    history: retarget({ past: history.past.slice(0, -1), future: [...history.future, step] }, next, affectedIds),
  };
}

export function redo(board: Board, history: History): Change {
  const step = history.future.at(-1);
  if (!step) throw Error("Nothing to redo.");
  const affectedIds = step.changes.map((c) => (c.after ?? c.before)!.id);
  const next = apply(board, step.changes.map((c) => ({ source: c.before, target: c.after })));
  return {
    board: next, affectedId: affectedIds[0], affectedIds,
    history: retarget({ past: [...history.past, step].slice(-100), future: history.future.slice(0, -1) }, next, affectedIds),
  };
}

function live(board: Board, target: Item): Item {
  const item = board.objects.find((o) => o.id === target.id && o.generation === target.generation);
  if (!item) throw Error("This object incarnation is no longer active.");
  return item;
}

function targets(board: Board, target: Item | Item[]): Item[] {
  const items = (Array.isArray(target) ? target : [target]).map((o) => live(board, o));
  if (!items.length) throw Error("Select an object to duplicate or delete.");
  return [...new Map(items.map((o) => [o.id, o])).values()].sort((a, b) => a.order - b.order);
}

export function duplicate(board: Board, history: History, target: Item | Item[]): Change {
  const items = targets(board, target);
  if (board.objects.length + items.length > 250) throw Error("250 object limit reached");
  const objects = [...board.objects];
  for (const item of items) {
    const current = { ...board, objects };
    const id = fresh(current);
    objects.push({
      ...item, id, generation: fresh(current, [id]),
      x: Math.max(-1e6, Math.min(1e6 - item.width, item.x + 24)),
      y: Math.max(-1e6, Math.min(1e6 - item.height, item.y + 24)),
      order: objects.length,
    });
  }
  const next = { ...board, objects };
  const affectedIds = objects.slice(board.objects.length).map((o) => o.id);
  return { board: next, history: record(history, board, next), affectedId: affectedIds[0], affectedIds };
}

export function deleteObject(board: Board, history: History, target: Item | Item[]): Change {
  const items = targets(board, target);
  const next = apply(board, items.map((source) => ({ source, target: null })));
  const affectedIds = items.map((o) => o.id);
  return { board: next, history: record(history, board, next), affectedId: affectedIds[0], affectedIds };
}
