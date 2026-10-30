// SPDX-License-Identifier: Apache-2.0
import type { Board } from "./document.ts";

// Both inputs have already passed document validation. History spanning more
// than these two states belongs to the room's persistent identifier ledger.
export function checkTransition(before: Board, after: Board): void {
  const fail = () => { throw Error("invalid_transition"); };
  if (before.boardId !== after.boardId || before.schemaVersion !== after.schemaVersion) fail();
  const retired = new Set(before.retiredGenerations);
  const nextRetired = new Set(after.retiredGenerations);
  if ([...retired].some((generation) => !nextRetired.has(generation))) fail();
  const previous = new Map(before.objects.map((object) => [object.id, object]));
  const used = new Set(before.objects.flatMap((object) => [object.id, object.generation]));
  for (const object of after.objects) {
    const old = previous.get(object.id);
    if (old && (old.generation !== object.generation || old.type !== object.type)) fail();
    if (retired.has(object.id) || retired.has(object.generation)) fail();
    if (!old && (used.has(object.id) || used.has(object.generation))) fail();
  }
  const next = new Map(after.objects.map((object) => [object.id, object.generation]));
  for (const object of before.objects) {
    if (next.get(object.id) !== object.generation && !nextRetired.has(object.generation)) fail();
  }
}
