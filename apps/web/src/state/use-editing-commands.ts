// SPDX-License-Identifier: Apache-2.0
import { useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { Board as SavedBoard, BoardV5 as Board, ItemV5 as Item } from "../document";
import { count } from "../document";
import { codePointOffset, formatted, toggle, type Flag } from "../marks";
import { deleteObject, duplicate, redo, undo, type History } from "../history";
import { savedHeight } from "../geometry";
import { textUnits, type Style } from "../styles";
import type { View } from "../view";
import { arrangeOrder, arrangePositions, arrangeReason, isOrderCommand, type ArrangeCommand } from "../arrange";
import { groupObjects, groupReason, ungroupObjects } from "../group";
import { buildPaste, buildSnapshot, clipboardReason, plainText, type ClipboardCommand, type Snapshot } from "../clipboard";

type Input = {
  model: RefObject<Board>;
  commit: (input: SavedBoard, recordObject?: boolean, orderIds?: readonly string[]) => void;
  historyRef: RefObject<History>;
  updateHistory: (next: History) => void;
  setDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  finishTextSession: () => void;
  setMessage: (value: string) => void;
  messageSequence: RefObject<number>;
  alive: RefObject<boolean>;
  select: (value: string | Iterable<string>) => void;
  selected: Set<string>;
  setInline: Dispatch<SetStateAction<boolean>>;
  scene: RefObject<HTMLDivElement | null>;
  editor: RefObject<HTMLTextAreaElement | null>;
  view: View;
  displayedObjects: (Item & { displayHeight: number })[];
  commandReason: string;
  selectionReason: string;
  clipboardState: Parameters<typeof clipboardReason>[3];
  editingState: Parameters<typeof arrangeReason>[2];
  arrangementMembers: (Item & { displayHeight: number })[];
  lineCount: (object: Item, text?: string) => number;
};

export function useEditingCommands({
  model, commit, historyRef, updateHistory, setDrafts, finishTextSession,
  setMessage, messageSequence, alive, select, selected, setInline, scene, view,
  displayedObjects, commandReason, selectionReason, clipboardState, editingState,
  arrangementMembers, lineCount, editor,
}: Input) {
  const [objectClipboard, setObjectClipboard] = useState<Snapshot | null>(null);
  function writePlainText(snapshot: Snapshot, copiedMessage: string) {
    const sequence = messageSequence.current;
    const failed = () => {
      if (alive.current && sequence === messageSequence.current) {
        setMessage(copiedMessage + " Text could not be placed on the system clipboard.");
      }
    };
    try {
      // Start in the command's event handler, while transient activation exists.
      if (!navigator.clipboard?.writeText) failed();
      else void navigator.clipboard.writeText(plainText(snapshot)).catch(failed);
    } catch { failed(); }
  }
  function clipboardCommand(name: ClipboardCommand) {
    const reason = clipboardReason(name, selected, objectClipboard, clipboardState);
    if (reason) { setMessage(reason); return; }
    try {
      if (name === "Paste") {
        const result = buildPaste(model.current, objectClipboard!, {
          centerX: view.x, centerY: view.y, zoom: view.z,
          width: scene.current!.clientWidth, height: scene.current!.clientHeight,
        });
        const ids = result.board.objects.slice(model.current.objects.length).map((o) => o.id);
        commit(result.board, true);
        select(ids);
        setObjectClipboard({ ...objectClipboard!, pasteCount: result.pasteCount });
        setMessage("Pasted " + ids.length + (ids.length === 1 ? " object." : " objects."));
      } else {
        const snapshot = buildSnapshot(model.current, selected, displayedObjects)!;
        const copiedMessage = name === "Cut" ? command("Cut")
          : "Copied " + snapshot.objects.length + (snapshot.objects.length === 1 ? " object." : " objects.");
        // Delete can refuse (for example at the retired-generation limit).
        if (!copiedMessage) return;
        setObjectClipboard(snapshot);
        if (name === "Copy") setMessage(copiedMessage);
        writePlainText(snapshot, copiedMessage);
      }
    } catch (error) { setMessage(String(error)); }
  }
  function command(name: "Undo" | "Redo" | "Duplicate" | "Delete" | "Cut") {
    if (commandReason) {
      setMessage(commandReason);
      return;
    }
    finishTextSession();
    try {
      const deleting = name === "Delete" || name === "Cut";
      const targets = model.current.objects.filter((o) => selected.has(o.id));
      const current = targets[0];
      if ((name === "Duplicate" || deleting) && !current) {
        setMessage("Select an object to " + name.toLowerCase() + ".");
        return;
      }
      const result = name === "Undo" ? undo(model.current, historyRef.current)
        : name === "Redo" ? redo(model.current, historyRef.current)
        : name === "Duplicate" ? duplicate(model.current, historyRef.current, targets)
        : deleteObject(model.current, historyRef.current, targets);
      const affected = result.board.objects.filter((o) => result.affectedIds.includes(o.id));
      commit(result.board);
      updateHistory(result.history);
      setDrafts((d) => {
        const next = { ...d };
        for (const id of result.affectedIds) delete next[id];
        return next;
      });
      // A history command closes the previous editing route without moving its focus.
      setInline(false);
      const remaining = [...selected].filter((id) => !result.affectedIds.includes(id));
      const removedSelection = remaining.length < selected.size;
      if (affected.length) select(affected.map((o) => o.id));
      else if (removedSelection || deleting) {
        select(deleting ? [] : remaining);
        if (deleting || !remaining.length) scene.current?.focus();
      }
      const label = current
        ? current.type + " " + (current.order + 1) + " · " + (current.text.slice(0, 36) || "Empty")
        : "object";
      const resultMessage = deleting ? (targets.length > 1
        ? (name === "Cut" ? "Cut " : "Deleted ") + targets.length + " objects. Undo restores them."
        : (name === "Cut" ? "Cut " : "Deleted ") + label + ". Undo restores it.")
        : name === "Duplicate" ? (targets.length > 1
          ? "Duplicated " + targets.length + " objects. Copies selected."
          : "Duplicated " + label + ". Copy selected.")
        : name + " complete. " + (affected.length > 1 ? affected.length + " affected objects selected."
          : affected.length ? "Affected object selected."
          : removedSelection ? remaining.length ? "Removed objects deselected." : "Selection cleared."
          : "Selection unchanged.");
      setMessage(resultMessage);
      return resultMessage;
    } catch (error) {
      setMessage(String(error));
    }
  }
  function arrangementReason(name: ArrangeCommand) {
    return name === "Group" || name === "Ungroup"
      ? groupReason(name, model.current, selected, editingState)
      : arrangeReason(name, arrangementMembers, editingState);
  }
  function arrange(name: ArrangeCommand) {
    if (arrangementReason(name)) return;
    finishTextSession();
    setInline(false);
    const current = model.current;
    if (name === "Group" || name === "Ungroup") {
      commit(name === "Group" ? groupObjects(current, selected) : ungroupObjects(current, selected), true);
    } else if (isOrderCommand(name)) {
      commit({ ...current, objects: arrangeOrder(name, current.objects, selected) }, true,
        current.objects.filter((o) => selected.has(o.id)).map((o) => o.id));
    } else {
      const positions = new Map(arrangePositions(name, arrangementMembers).map((p) => [p.id, p]));
      commit({ ...current, objects: current.objects.map((o) => positions.has(o.id)
        ? { ...o, x: positions.get(o.id)!.x, y: positions.get(o.id)!.y } : o) }, true);
    }
  }
  function changeStyle<K extends keyof Style>(key: K, value: Style[K]) {
    if (selectionReason) return;
    finishTextSession();
    setInline(false);
    const objects = model.current.objects.map((current) => {
      if (!selected.has(current.id) || current[key] === value) return current;
      const styled = { ...current, [key]: value };
      return key === "textSize"
        ? { ...styled, height: savedHeight(styled, lineCount(styled), textUnits(styled.textSize)) }
        : styled;
    });
    commit({ ...model.current, objects }, true);
  }
  function toggleFormat(flag: Flag) {
    if (selectionReason) return;
    finishTextSession();
    const field = editor.current;
    const beingEdited = field === document.activeElement && selected.size === 1;
    if (beingEdited && field) {
      const start = codePointOffset(field.value, field.selectionStart);
      const end = codePointOffset(field.value, field.selectionEnd);
      if (end > start) {
        const objects = model.current.objects.map((o) => {
          if (!selected.has(o.id)) return o;
          const next = { ...o, marks: toggle(o.marks, count(o.text), start, end, flag) };
          return { ...next, height: savedHeight(next, lineCount(next), textUnits(next.textSize)) };
        });
        commit({ ...model.current, objects }, true);
        return;
      }
    }
    if (!beingEdited) setInline(false);
    const targets = model.current.objects.filter((o) => selected.has(o.id) && o.text.length > 0);
    const remove = targets.every((o) => formatted(o.marks, count(o.text), flag));
    const objects = model.current.objects.map((o) => {
      if (!selected.has(o.id) || !o.text.length || formatted(o.marks, count(o.text), flag) !== remove) return o;
      const next = { ...o, marks: toggle(o.marks, count(o.text), 0, count(o.text), flag) };
      return { ...next, height: savedHeight(next, lineCount(next), textUnits(next.textSize)) };
    });
    commit({ ...model.current, objects }, true);
  }
  return { objectClipboard, command, clipboardCommand, arrangementReason, arrange, changeStyle, toggleFormat };
}
