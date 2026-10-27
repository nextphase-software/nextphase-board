// SPDX-License-Identifier: Apache-2.0
import type { RefObject } from "react";
import type { Board as SavedBoard, BoardV6 as Board, ItemV6 as Item } from "../document";
import type { History } from "../history";
import { placementTool } from "../objects/registry";
import { editingCommandReason } from "../commands";

type Input = {
  readOnly: boolean;
  composing: boolean;
  busy: boolean;
  tool: string;
  invalidObjectText: boolean;
  invalid: boolean;
  textSession: RefObject<{ before: Board; id: string } | null>;
  model: RefObject<Board>;
  history: History;
  selected: Set<string>;
  visibleMessage: string;
  snapshots: { board: SavedBoard; revision: number }[];
  displayedObjects: (Item & { displayHeight: number })[];
};

export function useCommandReasons({
  readOnly, composing, busy, tool, invalidObjectText, invalid, textSession, model,
  history, selected, visibleMessage, snapshots, displayedObjects,
}: Input) {
  const commandReason = editingCommandReason({ readOnly, composing, pointerGesture: busy, invalidObjectText });
  const session = textSession.current;
  const sessionChanged = !!session &&
    JSON.stringify(session.before.objects.find((o) => o.id === session.id)) !==
      JSON.stringify(model.current.objects.find((o) => o.id === session.id));
  const undoReason = commandReason || (!history.past.length && !sessionChanged ? "Nothing to undo." : "");
  const redoReason = commandReason || (sessionChanged || !history.future.length ? "Nothing to redo." : "");
  const selectionReason = commandReason || (!selected.size ? "Select an object to duplicate or delete." : "");
  const clipboardState = { readOnly, composing, pointerGesture: busy, invalidObjectText };
  const showNotice = !!(visibleMessage || invalid || busy || readOnly ||
    placementTool(tool) || snapshots.length);
  const editingState = { readOnly, composing, pointerGesture: busy, invalidObjectText };
  const arrangementMembers = displayedObjects.filter((o) => selected.has(o.id));
  return {
    commandReason, undoReason, redoReason, selectionReason, clipboardState,
    showNotice, editingState, arrangementMembers,
  };
}
