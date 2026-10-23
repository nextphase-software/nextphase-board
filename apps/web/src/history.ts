// SPDX-License-Identifier: Apache-2.0
import type { Board, Item } from "./document.ts";

export type Step = { before: Item | null; after: Item | null };
export type History = { past: Step[]; future: Step[] };
export type Change = { board: Board; history: History; affectedId: string };
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
  if (changed.length !== 1) throw Error("History requires one object transaction");
  const id = changed[0];
  const step = {
    before: before.objects.find((o) => o.id === id) ?? null,
    after: after.objects.find((o) => o.id === id) ?? null,
  };
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

function apply(board: Board, source: Item | null, target: Item | null): Board {
  const id = (source ?? target)!.id;
  const current = board.objects.find((o) => o.id === id);
  if (source ? !current || current.generation !== source.generation : !!current) {
    throw Error("This object incarnation is no longer active.");
  }
  let retiredGenerations = board.retiredGenerations;
  if (current && !target) {
    if (retiredGenerations.length >= 10000) {
      throw Error("10,000 retired-generation limit reached; this command cannot remove an object.");
    }
    retiredGenerations = [...retiredGenerations, current.generation].sort();
  }
  if (!current && target && board.objects.length >= 250) {
    throw Error("250 object limit reached");
  }
  const objects = board.objects.filter((o) => o.id !== id);
  if (target) {
    objects.splice(target.order, 0, {
      ...target,
      generation: current?.generation ?? fresh(board, [target.id, target.generation]),
    });
  }
  return {
    ...board, retiredGenerations,
    objects: objects.map((o, order) => ({ ...o, order })),
  };
}

// Resurrection creates a new incarnation for this session's remaining steps.
// External commands holding an old history/target still fail the generation check.
function retarget(history: History, board: Board, id: string): History {
  const generation = board.objects.find((o) => o.id === id)?.generation;
  if (!generation) return history;
  const item = (value: Item | null) => value?.id === id ? { ...value, generation } : value;
  const steps = (list: Step[]) => list.map((step) => ({ before: item(step.before), after: item(step.after) }));
  return { past: steps(history.past), future: steps(history.future) };
}

export function undo(board: Board, history: History): Change {
  const step = history.past.at(-1);
  if (!step) throw Error("Nothing to undo.");
  const affectedId = (step.before ?? step.after)!.id;
  const next = apply(board, step.after, step.before);
  return {
    board: next, affectedId,
    history: retarget({ past: history.past.slice(0, -1), future: [...history.future, step] }, next, affectedId),
  };
}

export function redo(board: Board, history: History): Change {
  const step = history.future.at(-1);
  if (!step) throw Error("Nothing to redo.");
  const affectedId = (step.after ?? step.before)!.id;
  const next = apply(board, step.before, step.after);
  return {
    board: next, affectedId,
    history: retarget({ past: [...history.past, step].slice(-100), future: history.future.slice(0, -1) }, next, affectedId),
  };
}

function live(board: Board, target: Item): Item {
  const item = board.objects.find((o) => o.id === target.id && o.generation === target.generation);
  if (!item) throw Error("This object incarnation is no longer active.");
  return item;
}

export function duplicate(board: Board, history: History, target: Item): Change {
  const item = live(board, target);
  if (board.objects.length >= 250) throw Error("250 object limit reached");
  const id = fresh(board);
  const copy = {
    ...item, id, generation: fresh(board, [id]),
    x: Math.max(-1e6, Math.min(1e6 - item.width, item.x + 24)),
    y: Math.max(-1e6, Math.min(1e6 - item.height, item.y + 24)),
    order: board.objects.length,
  };
  const next = { ...board, objects: [...board.objects, copy] };
  return { board: next, history: record(history, board, next), affectedId: id };
}

export function deleteObject(board: Board, history: History, target: Item): Change {
  const item = live(board, target);
  const next = apply(board, item, null);
  return { board: next, history: record(history, board, next), affectedId: item.id };
}
