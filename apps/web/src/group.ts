// SPDX-License-Identifier: Apache-2.0
import { freshIdentifier, type BoardV3 } from "./document.ts";
import { editingCommandReason } from "./commands.ts";

type Member = { id: string; group: string | null; order: number };
export type GroupCommand = "Group" | "Ungroup";
type EditingState = Parameters<typeof editingCommandReason>[0];

export function expandSelection(objects: readonly Member[], selected: Iterable<string>): Set<string> {
  const ids = new Set(selected);
  const groups = new Set(objects.filter((o) => ids.has(o.id) && o.group !== null).map((o) => o.group));
  return new Set(objects.filter((o) => ids.has(o.id) || o.group !== null && groups.has(o.group)).map((o) => o.id));
}

// The sole selected member is deliberately kept alone after native selection or
// double-click. A release collapsing a larger selection uses this same rule.
export function pressSelection(objects: readonly Member[], selected: ReadonlySet<string>, id: string): Set<string> {
  return selected.size === 1 && selected.has(id) ? new Set(selected) : expandSelection(objects, [id]);
}

export function toggleGroup(objects: readonly Member[], selected: ReadonlySet<string>, id: string): Set<string> {
  const group = expandSelection(objects, [id]);
  const whole = [...group].every((member) => selected.has(member));
  const next = new Set(selected);
  for (const member of group) {
    if (whole) next.delete(member); else next.add(member);
  }
  return next;
}

export function wholeGroups<T extends Member>(objects: readonly T[], selected: ReadonlySet<string>): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const o of objects) {
    if (o.group !== null) groups.set(o.group, [...(groups.get(o.group) ?? []), o]);
  }
  return new Map([...groups].filter(([, members]) => members.every((o) => selected.has(o.id))));
}

export function groupNumbers(objects: readonly Member[]): Map<string, number> {
  const numbers = new Map<string, number>();
  for (const o of [...objects].sort((a, b) => a.order - b.order)) {
    if (o.group !== null && !numbers.has(o.group)) numbers.set(o.group, numbers.size + 1);
  }
  return numbers;
}

export function groupReason(command: GroupCommand, board: BoardV3, selected: ReadonlySet<string>, state: EditingState): string {
  const editing = editingCommandReason(state);
  if (editing) return editing;
  const members = board.objects.filter((o) => selected.has(o.id));
  if (command === "Ungroup") return members.some((o) => o.group !== null) ? "" : "Select a grouped object to ungroup.";
  if (members.length < 2) return "Select two or more objects to group.";
  const group = members[0].group;
  return group !== null && members.every((o) => o.group === group) &&
    board.objects.every((o) => o.group !== group || selected.has(o.id))
    ? "The selected objects are already one group." : "";
}

const editable = { readOnly: false, composing: false, pointerGesture: false, invalidObjectText: false };
export function groupObjects(board: BoardV3, selected: ReadonlySet<string>): BoardV3 {
  const reason = groupReason("Group", board, selected, editable);
  if (reason) throw Error(reason);
  const group = freshIdentifier(board);
  return { ...board, objects: board.objects.map((o) => selected.has(o.id) ? { ...o, group } : o) };
}

export function ungroupObjects(board: BoardV3, selected: ReadonlySet<string>): BoardV3 {
  const reason = groupReason("Ungroup", board, selected, editable);
  if (reason) throw Error(reason);
  const groups = new Set(board.objects.filter((o) => selected.has(o.id) && o.group !== null).map((o) => o.group));
  return { ...board, objects: board.objects.map((o) => o.group !== null && groups.has(o.group) ? { ...o, group: null } : o) };
}
