// SPDX-License-Identifier: Apache-2.0
import { useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { Board as SavedBoard, BoardV8 as Board, ItemV8 as Item, ResolvedItem } from "../document";
import { count } from "../document";
import { catalog } from "../activities/catalog";
import { activityPreview, insertActivity, readActivity, type Activity, type Preview } from "../activities";
import { codePointOffset, formatted, toggle, type Flag } from "../marks";
import { deleteObject, duplicate, redo, undo, type History } from "../history";
import { savedHeight } from "../geometry";
import { textUnits, type Style } from "../styles";
import type { View } from "../view";
import { arrangePositions, arrangeReason, isOrderCommand, type ArrangeCommand } from "../arrange";
import { assignSection, commandObjectLabel, orderInBands, wrapReason, wrapSelection } from "../sections";
import { objectType, hasRectangle, hasText, hasPoints, isDrawingTool, type InkWeight, hasEnds, usesShapePaint, changeKind, changeFill, changeBorder, paintOf, paintAfterStep, type ShapeKeys, type ShapePaint } from "../objects/registry";
import { groupObjects, groupReason, ungroupObjects } from "../group";
import { buildPaste, buildSnapshot, clipboardReason, plainText, type ClipboardCommand, type Snapshot } from "../clipboard";

import { changeStrokeWeight, changeStrokeColor, changeOrdinaryColor } from "../strokes";
import { copiedSet, copiedSetReason, cascadeCount, connectReason, createConnector } from "../connectors";

type Input = {
  tool: string;
  shapeSession: { update: (paint: ShapePaint) => void };
  growHeight: number;
  growAvailable: boolean;
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
  selector?: RefObject<HTMLSelectElement | null>;
  setPanel: Dispatch<SetStateAction<string>>;
  setTool: Dispatch<SetStateAction<string>>;
  view: View;
  setView: Dispatch<SetStateAction<View>>;
  displayedObjects: ResolvedItem[];
  commandReason: string;
  selectionReason: string;
  clipboardState: Parameters<typeof clipboardReason>[3];
  editingState: Parameters<typeof arrangeReason>[2];
  arrangementMembers: ResolvedItem[];
  lineCount: (object: Item, text?: string) => number;
};

export function useEditingCommands({
  tool, shapeSession, growHeight, growAvailable, model, commit, historyRef, updateHistory, setDrafts, finishTextSession,
  setMessage, messageSequence, alive, select, selected, setInline, scene, view, setView,
  displayedObjects, commandReason, selectionReason, clipboardState, editingState,
  arrangementMembers, lineCount, editor, selector, setPanel, setTool,
}: Input) {
  const [objectClipboard, setObjectClipboard] = useState<Snapshot | null>(null);
  const [templatePreviews, setTemplatePreviews] = useState<Record<string, Preview>>({});
  const activityState = useRef({ commandReason, view });
  activityState.current = { commandReason, view };
  async function loadTemplates() {
    if (Object.keys(templatePreviews).length === catalog.length) return;
    const entries = await Promise.all(catalog.map(async (entry) => {
      try { return [entry.id, activityPreview((await readActivity(entry)).objects)] as const; }
      catch { return [entry.id, undefined] as const; }
    }));
    if (alive.current) setTemplatePreviews(Object.fromEntries(entries.filter((entry) => entry[1])) as Record<string, Preview>);
  }
  async function addActivity(entry: Activity) {
    if (activityState.current.commandReason) { setMessage(activityState.current.commandReason); return; }
    let activity;
    try { activity = await readActivity(entry); }
    catch (error) {
      if (alive.current) setMessage(`Could not add “${entry.name}”: ${error instanceof Error ? error.message : String(error)}.`);
      return;
    }
    if (!alive.current || activityState.current.commandReason) return;
    try {
      const result = insertActivity(model.current, activity, activityState.current.view, {
        w: scene.current!.clientWidth, h: scene.current!.clientHeight,
      });
      finishTextSession();
      commit(result.board, true);
      select(result.ids);
      setPanel("");
      setView(result.view);
      scene.current?.focus();
      setMessage(`Added “${entry.name}”: ${result.ids.length} objects.`);
    } catch (error) { setMessage(String(error)); }
  }
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
    const reason = clipboardReason(name, selected, objectClipboard, clipboardState, model.current.objects);
    if (reason) { setMessage(reason); return; }
    try {
      if (name === "Paste") {
        const result = buildPaste(model.current, objectClipboard!, {
          centerX: view.x, centerY: view.y, zoom: view.z,
          width: scene.current!.clientWidth, height: scene.current!.clientHeight,
        });
        const existing = new Set(model.current.objects.map((o) => o.id));
        const ids = result.board.objects.filter((o) => !existing.has(o.id)).map((o) => o.id);
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
    if ((name === "Duplicate" || name === "Cut") && copiedSetReason(model.current.objects, selected)) {
      setMessage(copiedSetReason(model.current.objects, selected)); return;
    }
    finishTextSession();
    try {
      const deleting = name === "Delete" || name === "Cut";
      const acted = name === "Cut" || name === "Duplicate" ? copiedSet(model.current.objects, selected) : selected;
      const targets = model.current.objects.filter((o) => acted.has(o.id));
      const current = targets[0];
      const label = current ? commandObjectLabel(model.current, current) : "object";
      const removedConnectors = deleting && targets.some(hasRectangle) ? cascadeCount(model.current.objects, acted) : 0;
      if ((name === "Duplicate" || deleting) && !current) {
        setMessage("Select an object to " + name.toLowerCase() + ".");
        return;
      }
      const paint = name === "Undo" || name === "Redo" ? paintAfterStep(
        (name === "Undo" ? historyRef.current.past : historyRef.current.future).at(-1), name === "Undo") : undefined;
      const result = name === "Undo" ? undo(model.current, historyRef.current)
        : name === "Redo" ? redo(model.current, historyRef.current)
        : name === "Duplicate" ? duplicate(model.current, historyRef.current, targets)
        : deleteObject(model.current, historyRef.current, targets);
      const affected = result.board.objects.filter((o) => result.affectedIds.includes(o.id));
      commit(result.board);
      updateHistory(result.history);
      if (paint) shapeSession.update(paint);
      setDrafts((d) => {
        const next = { ...d };
        for (const id of result.affectedIds) delete next[id];
        return next;
      });
      // A history command closes the previous editing route without moving its focus.
      setInline(false);
      const remaining = [...selected].filter((id) => !result.affectedIds.includes(id));
      const removedSelection = remaining.length < selected.size;
      if ((name === "Undo" || name === "Redo") && isDrawingTool(tool)) select([]);
      else if (affected.length) select(affected.map((o) => o.id));
      else if (removedSelection || deleting) {
        select(deleting ? [] : remaining);
        if (deleting || !remaining.length) scene.current?.focus();
      }
      const resultMessage = deleting ? (targets.length > 1
        ? (name === "Cut" ? "Cut " : "Deleted ") + targets.length + " objects. Undo restores them."
        : (name === "Cut" ? "Cut " : "Deleted ") + label + ". Undo restores it.")
        : name === "Duplicate" ? (targets.length > 1
          ? "Duplicated " + targets.length + " objects. Copies selected."
          : "Duplicated " + label + ". Copy selected.")
        : isDrawingTool(tool) ? name + " complete."
        : name + " complete. " + (affected.length > 1 ? affected.length + " affected objects selected."
          : affected.length ? "Affected object selected."
          : removedSelection ? remaining.length ? "Removed objects deselected." : "Selection cleared."
          : "Selection unchanged.");
      const notice = resultMessage + (removedConnectors ? " " + removedConnectors + (removedConnectors === 1 ? " connector removed with the ideas." : " connectors removed with the ideas.") : "");
      setMessage(notice);
      return notice;
    } catch (error) {
      setMessage(String(error));
    }
  }
  function arrangementReason(name: ArrangeCommand) {
    if (name === "Connect") return connectReason(model.current, selected, editingState);
    if (name === "Section from selection") return wrapReason(model.current, selected, displayedObjects, editingState);
    return name === "Group" || name === "Ungroup"
      ? groupReason(name, model.current, selected, editingState)
      : arrangeReason(name, arrangementMembers, editingState);
  }
  function arrange(name: ArrangeCommand, native = false) {
    if (arrangementReason(name)) return;
    finishTextSession();
    setInline(false);
    const current = model.current;
    if (name === "Connect") {
      const ideas = current.objects.filter((o) => selected.has(o.id)).sort((a, b) => a.order - b.order);
      const result = createConnector(current, ideas[0].id, ideas[1].id);
      commit(result.board, true); select(result.id); setTool("Select");
      if (native) selector?.current?.focus(); else scene.current?.focus();
    } else if (name === "Section from selection") {
      const result = wrapSelection(current, selected, displayedObjects);
      commit(result.board, true);
      select(result.id);
      setTool("Select");
      setPanel(native ? "Objects" : "");
      setInline(!native);
      if (native) setTimeout(() => { editor.current?.focus(); editor.current?.select(); }, 0);
    } else if (name === "Group" || name === "Ungroup") {
      commit(name === "Group" ? groupObjects(current, selected) : ungroupObjects(current, selected), true);
    } else if (isOrderCommand(name)) {
      commit({ ...current, objects: orderInBands(name, current.objects, selected) }, true,
        current.objects.filter((o) => selected.has(o.id)).map((o) => o.id));
    } else {
      const positions = new Map(arrangePositions(name, arrangementMembers).map((p) => [p.id, p]));
      commit({ ...current, objects: current.objects.map((o) => positions.has(o.id)
        ? { ...o, x: positions.get(o.id)!.x, y: positions.get(o.id)!.y } : o) }, true);
    }
  }
  function setSection(id: string | null) {
    if (selectionReason) return;
    const next = assignSection(model.current, selected, id);
    if (next === model.current) return;
    finishTextSession();
    setInline(false);
    commit(next, true);
  }
  function changeStyle<K extends keyof Style>(key: K, value: Style[K]) {
    if (selectionReason || key !== "color" && model.current.objects.some((o) => selected.has(o.id) && hasRectangle(o) && !objectType(o.type).richText)) return;
    finishTextSession();
    setInline(false);
    if (key === "color") { commit({ ...model.current, objects: changeOrdinaryColor(model.current.objects, selected, value as Style["color"]) }, true); return; }
    const objects = model.current.objects.map((current) => {
      if (!hasRectangle(current) || !hasText(current) || !selected.has(current.id) || current[key] === value) return current;
      const styled = { ...current, [key]: value };
      return key === "textSize" && objectType(styled.type).growsWithText
        ? { ...styled, height: savedHeight(styled, lineCount(styled), textUnits(styled.textSize)) }
        : styled;
    });
    commit({ ...model.current, objects }, true);
  }
  function toggleFormat(flag: Flag) {
    if (selectionReason || model.current.objects.some((o) => selected.has(o.id) && hasRectangle(o) && !objectType(o.type).richText)) return;
    finishTextSession();
    const field = editor.current;
    const beingEdited = field === document.activeElement && selected.size === 1;
    if (beingEdited && field) {
      const start = codePointOffset(field.value, field.selectionStart);
      const end = codePointOffset(field.value, field.selectionEnd);
      if (end > start) {
        const objects = model.current.objects.map((o) => {
          if (!hasRectangle(o) || !hasText(o) || !selected.has(o.id)) return o;
          const next = { ...o, marks: toggle(o.marks, count(o.text), start, end, flag) };
          return { ...next, height: objectType(next.type).growsWithText ? savedHeight(next, lineCount(next), textUnits(next.textSize)) : next.height };
        });
        commit({ ...model.current, objects }, true);
        return;
      }
    }
    if (!beingEdited) setInline(false);
    const targets = model.current.objects.filter(hasRectangle).filter(hasText).filter((o) => selected.has(o.id) && o.text.length > 0);
    const remove = targets.every((o) => formatted(o.marks, count(o.text), flag));
    const objects = model.current.objects.map((o) => {
      if (!hasRectangle(o) || !hasText(o) || !selected.has(o.id) || !o.text.length || formatted(o.marks, count(o.text), flag) !== remove) return o;
      const next = { ...o, marks: toggle(o.marks, count(o.text), 0, count(o.text), flag) };
      return { ...next, height: objectType(next.type).growsWithText ? savedHeight(next, lineCount(next), textUnits(next.textSize)) : next.height };
    });
    commit({ ...model.current, objects }, true);
  }
  function shapeCommand(change: (o: Item & { x: number; y: number; width: number; height: number }) => Item, paint = false) {
    if (selectionReason) return;
    finishTextSession(); setInline(false);
    const changed: Item[] = [];
    const objects = model.current.objects.map((o) => {
      if (!hasRectangle(o) || !hasText(o) || !selected.has(o.id) || !usesShapePaint(o)) return o;
      const next = change(o);
      if (next !== o) changed.push(next);
      return next;
    });
    if (!changed.length) return;
    commit({ ...model.current, objects }, true);
    if (paint) shapeSession.update(paintOf(changed.at(-1)!));
  }
  const changeShape = (kind: ShapeKeys["shape"]) => shapeCommand((o) => changeKind(o, kind));
  const changeShapeFill = (value: Partial<ShapeKeys["fill"]>) => shapeCommand((o) => changeFill(o, value), true);
  const changeShapeBorder = (value: Partial<ShapeKeys["border"]>) => shapeCommand((o) => changeBorder(o, value), true);
  function grow() {
    if (!growAvailable) return;
    shapeCommand((o) => ({ ...o, height: growHeight }));
  }
  function strokeWeight(weight: InkWeight) {
    if (selectionReason) return;
    try {
      const objects = model.current.objects.map((o) => hasPoints(o) && selected.has(o.id) ? changeStrokeWeight(o, weight) : o);
      finishTextSession(); setInline(false); commit({ ...model.current, objects }, true);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
  }
  function strokeColor(color: string) {
    if (selectionReason) return;
    const objects = changeStrokeColor(model.current.objects, selected, color);
    finishTextSession(); setInline(false); commit({ ...model.current, objects }, true);
  }
  const strokeCommands = { color: strokeColor, weight: strokeWeight };
  const shapeCommands = { changeShape, changeFill: changeShapeFill, changeBorder: changeShapeBorder, grow };
  return { strokeCommands, loadTemplates, addActivity, templatePreviews, shapeCommands, setSection, objectClipboard, command, clipboardCommand, arrangementReason, arrange, changeStyle, toggleFormat };
}
