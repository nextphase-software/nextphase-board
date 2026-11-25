// SPDX-License-Identifier: Apache-2.0
import { useRef, useState, type ClipboardEvent, type Dispatch, type DragEvent, type RefObject, type SetStateAction } from "react";
import type { Board as SavedBoard, BoardV14 as Board, ItemV14 as Item } from "nextphase-board-rules/document.ts";
import { count } from "nextphase-board-rules/document.ts";
import { catalog } from "../activities/catalog";
import { activityPreview, insertActivity, readActivity, type Activity, type Preview } from "../activities";
import { codePointOffset, formatted, toggle, type Flag } from "nextphase-board-rules/marks.ts";
import { deleteObject, duplicate, record, redo, undo, type History } from "../history";
import { savedHeight, type ResolvedItem } from "../geometry";
import { textUnits, type Style } from "nextphase-board-rules/styles.ts";
import type { View } from "../view";
import { arrangePositions, arrangeReason, isOrderCommand, type ArrangeCommand } from "../arrange";
import { assignSection, commandObjectLabel, orderInBands, wrapReason, wrapSelection } from "../sections";
import { isTape, type TapePattern, type ConnectorStyle, type End, objectType, isMedia, isVideo, pictureOf, hasRectangle, hasText, isTable, insertAxis, deleteAxis, cellText, cellAt, cellIndex, setCell, hasPoints, isDrawingTool, type InkWeight, hasEnds, usesShapePaint, changeKind, changeFill, changeBorder, paintOf, paintAfterStep, isMindNode, type ShapeKeys, type ShapePaint } from "nextphase-board-rules/objects/registry.ts";
import { addChild, addSibling, collapse, descendants, hiddenIds, settle, withHiddenDescendants, MAP_WORDS, type MapCommand, type MeasureNode } from "../mind-map";
import { editingCommandReason } from "../commands";
import { groupObjects, groupReason, ungroupObjects } from "../group";
import { tabPictures, tabVideos } from "../image-assets.ts";
import { PASTE_NOT_LOADED } from "../images.ts";
import { buildPaste, buildSnapshot, clipboardReason, plainText, type ClipboardCommand, type Snapshot } from "../clipboard";

import { TIDY_WAIT } from "../tidy-up";
import { changeStrokeWeight, changeStrokeColor, changeOrdinaryColor } from "../strokes";
import { copiedSet, copiedSetReason, cascadeCount, connectReason, createConnector, changeConnectorStyle, reconnect } from "../connectors";

import type { HostedBoard } from "../team/hosted-board";

import type { TableItem } from "nextphase-board-rules/document.ts";
import type { TableOrderHint } from "nextphase-board-sync/document-adapter.ts";
import { anchorCell, boundTable, growTable, layoutTable, tableReason, type MeasureCell, type TableAction, type TableSelection } from "../table";
import { addTableData, isCanvasPasteTarget, isCsvFile, isSpreadsheetData, readCsvFile, readSpreadsheet, tableCsv, tableCsvName,
  type TableDataAnchor, type TableDataItem } from "../table-csv";

type Input = {
  tableSelection?: TableSelection;
  tableMeasure: MeasureCell;
  chooseTable: (selection: TableSelection, table: TableItem) => void;
  growTableRows: (table: TableItem) => TableItem;
  pages?: import("../pages").PageNavigation;
  hosted?: HostedBoard;
  tool: string;
  connectorStyle: RefObject<ConnectorStyle>;
  shapeSession: { update: (paint: ShapePaint) => void };
  growHeight: number;
  growAvailable: boolean;
  model: RefObject<Board>;
  commit: (input: SavedBoard, recordObject?: boolean, orderIds?: readonly string[], opens?: string, movedPages?: readonly string[], tableHint?: TableOrderHint) => void;
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
  measureNode: MeasureNode;
};
const MAP_COMMANDS: readonly string[] = ["Add child", "Add child left", "Add child right", "Add sibling", "Collapse", "Expand"] satisfies MapCommand[];
type CopyRecord = { id: number; text: string; state: "pending" | "written" | "refused" };

export function useEditingCommands({
  tableSelection, tableMeasure, chooseTable, growTableRows, pages: navigation, tool, connectorStyle, shapeSession, growHeight, growAvailable, model, commit, historyRef, updateHistory, setDrafts, finishTextSession,
  setMessage, messageSequence, alive, select, selected, setInline, scene, view, setView,
  displayedObjects, commandReason, selectionReason, clipboardState, editingState,
  arrangementMembers, lineCount, measureNode, editor, selector, setPanel, setTool, hosted,
}: Input) {
  const pages = navigation ?? { id: model.current.boardId, openingReason: "", openPage: () => undefined, afterHistory: () => {} };
  const [objectClipboard, setObjectClipboard] = useState<Snapshot | null>(null);
  const [templatePreviews, setTemplatePreviews] = useState<Record<string, Preview>>({});
  const copyRecord = useRef<CopyRecord | null>(null);
  const latest = useRef({ commandReason, view, page: pages.id, applyTableBatch });
  latest.current = { commandReason, view, page: pages.id, applyTableBatch };
  async function loadTemplates() {
    if (Object.keys(templatePreviews).length === catalog.length) return;
    const entries = await Promise.all(catalog.map(async (entry) => {
      try { return [entry.id, activityPreview((await readActivity(entry)).objects)] as const; }
      catch { return [entry.id, undefined] as const; }
    }));
    if (alive.current) setTemplatePreviews(Object.fromEntries(entries.filter((entry) => entry[1])) as Record<string, Preview>);
  }
  async function addActivity(entry: Activity) {
    if (latest.current.commandReason) { setMessage(latest.current.commandReason); return; }
    let activity;
    try { activity = await readActivity(entry); }
    catch (error) {
      if (alive.current) setMessage(`Could not add “${entry.name}”: ${error instanceof Error ? error.message : String(error)}.`);
      return;
    }
    if (!alive.current || latest.current.commandReason) return;
    try {
      const result = insertActivity(model.current, activity, latest.current.view, {
        w: scene.current!.clientWidth, h: scene.current!.clientHeight,
      }, latest.current.page);
      finishTextSession();
      commit(result.board, true);
      select(result.ids);
      setPanel("");
      setView(result.view);
      scene.current?.focus();
      setMessage(`Added “${entry.name}”: ${result.ids.length} objects.`);
    } catch (error) { setMessage(String(error)); }
  }
  function insertStored(name: string, activity: Board) {
    if (!alive.current) return;
    if (latest.current.commandReason) { hosted?.toast(latest.current.commandReason); return; }
    try {
      const result = insertActivity(model.current, activity, latest.current.view, {
        w: scene.current!.clientWidth, h: scene.current!.clientHeight,
      }, latest.current.page);
      finishTextSession(); commit(result.board, true); select(result.ids); setPanel(""); setView(result.view);
      scene.current?.focus(); hosted?.toast(`Added “${name}”: ${result.ids.length} objects.`);
    } catch (error) { hosted?.toast(String(error)); }
  }
  const templateCommands = { addActivity, insertStored, commandReason, selected: selected.size > 0, objectCount: model.current.objects.length,
    closeTemplates: () => setPanel(""),
    snapshot: () => ({ title: model.current.title, selected: selected.size > 0,
      snapshot: buildSnapshot(model.current, selected.size ? selected : new Set(model.current.objects.map(o => o.id)), displayedObjects, measureNode) }) };
  function writePlainText(snapshot: Snapshot, copiedMessage: string) {
    const sequence = messageSequence.current;
    const text = plainText(snapshot), id = (copyRecord.current?.id ?? 0) + 1;
    copyRecord.current = { id, text, state: "pending" };
    const settleWrite = (state: CopyRecord["state"]) => {
      if (copyRecord.current?.id === id) copyRecord.current = { id, text, state };
    };
    const failed = () => {
      settleWrite("refused");
      if (alive.current && sequence === messageSequence.current) {
        setMessage(copiedMessage + " Text could not be placed on the system clipboard.");
      }
    };
    try {
      // Start in the command's event handler, while transient activation exists.
      if (!navigator.clipboard?.writeText) failed();
      else void navigator.clipboard.writeText(text).then(() => settleWrite("written"), failed);
    } catch { failed(); }
  }
  function dataExchangeReason(invalidObjectText = clipboardState.invalidObjectText) {
    return selectionReason === TIDY_WAIT ? TIDY_WAIT : editingCommandReason({
      ...clipboardState, invalidObjectText, readOnly: clipboardState.readOnly || hosted?.canEdit === false,
    });
  }
  const voting = () => !!hosted?.voting?.mode;
  const canAddTable = () => !dataExchangeReason() && !voting();
  const anchorAt = (point = { x: view.x, y: view.y }): TableDataAnchor => ({
    boardId: model.current.boardId, page: pages.id, point,
  });
  function applyTableBatch(anchor: TableDataAnchor, items: readonly TableDataItem[]) {
    const board = model.current;
    if (!alive.current || board.boardId !== anchor.boardId || pages.id !== anchor.page ||
        !board.pages.some(page => page.id === anchor.page) || !canAddTable()) return;
    const batch = addTableData(board, items, anchor, !!hosted, (table, centre) => {
      const grown = growTable(table, tableMeasure);
      const { width, height } = layoutTable(grown, tableMeasure).box;
      return boundTable({ ...grown, x: centre.x - width / 2, y: centre.y - height / 2 }, height);
    });
    if (batch.ids.length) {
      commit(batch.board, true);
      const saved = new Set(model.current.objects.map(o => o.id));
      if (batch.ids.every(id => saved.has(id))) {
        select(batch.ids);
        setTool("Select");
        setPanel("");
        scene.current?.focus();
        setMessage(batch.refusal ? batch.success + " " + batch.refusal : batch.success);
        return;
      }
    }
    if (batch.refusal) setMessage(batch.refusal);
  }
  async function readFileBatch(files: readonly File[], anchor: TableDataAnchor) {
    const items: TableDataItem[] = [];
    for (const file of files) items.push(await readCsvFile(file));
    latest.current.applyTableBatch(anchor, items);
  }
  function importFiles(files: File[], anchor: TableDataAnchor) {
    const reason = dataExchangeReason();
    if (reason) { setMessage(reason); return; }
    return readFileBatch(files, anchor);
  }
  function chooseCsv() {
    if (!canAddTable()) return;
    const anchor = anchorAt();
    const field = document.createElement("input");
    field.type = "file"; field.multiple = true; field.accept = ".csv,text/csv"; field.hidden = true;
    const clean = () => field.remove();
    field.addEventListener("change", () => {
      const files = Array.from(field.files ?? []);
      clean();
      if (!files.length || !alive.current) return;
      setPanel("");
      void readFileBatch(files, anchor);
    }, { once: true });
    field.addEventListener("cancel", clean, { once: true });
    document.body.append(field);
    field.click();
  }
  const paste = (next: (event: ClipboardEvent<HTMLDivElement>) => void | Promise<void>) => (event: ClipboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || voting() || !isCanvasPasteTarget(event)) return next(event);
    const files = Array.from(event.clipboardData.files);
    if (files.length) {
      if (!files.some(isCsvFile)) return next(event);
      event.preventDefault();
      return importFiles(files, anchorAt());
    }
    if (!canAddTable()) return next(event);
    const text = event.clipboardData.getData("text/plain");
    const ownCopy = objectClipboard && copyRecord.current && (copyRecord.current.text === text || copyRecord.current.state === "refused");
    if (ownCopy || !isSpreadsheetData(text, event.clipboardData.getData("text/html"))) return next(event);
    event.preventDefault();
    applyTableBatch(anchorAt(), [readSpreadsheet(text)]);
  };
  const drop = (next: (event: DragEvent<HTMLDivElement>) => void | Promise<void>) => (event: DragEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || voting() || !(event.target instanceof Element) ||
        !event.currentTarget.contains(event.target) || event.target.closest("input,textarea,[contenteditable]:not([contenteditable=false])")) {
      return next(event);
    }
    const files = Array.from(event.dataTransfer.files);
    if (!files.some(isCsvFile)) return next(event);
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    return importFiles(files, anchorAt({
      x: view.x + (event.clientX - bounds.left - bounds.width / 2) / view.z,
      y: view.y + (event.clientY - bounds.top - bounds.height / 2) / view.z,
    }));
  };
  function exportAvailability() {
    const reason = dataExchangeReason(false);
    const object = selected.size === 1 ? model.current.objects.find(o => selected.has(o.id)) : undefined;
    return { reason, table: !reason && !voting() && object && isTable(object) ? object : undefined };
  }
  const exportState = exportAvailability();
  const exportTable = Object.assign(() => {
    const { table } = exportAvailability();
    if (!table) return false;
    const url = URL.createObjectURL(new Blob([tableCsv(table)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = tableCsvName(model.current.title);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    scene.current?.focus();
    return true;
  }, { reason: exportState.reason, disabled: !exportState.table });
  const tableData = { paste, drop, exportTable, importButton: {
    shown: hosted?.snapshot.role !== "viewer", disabled: !canAddTable(), choose: chooseCsv,
  } };
  function clipboardCommand(name: ClipboardCommand) {
    if (selectionReason === TIDY_WAIT) { setMessage(selectionReason); return; }
    const reason = clipboardReason(name, selected, objectClipboard, clipboardState, model.current.objects);
    if (reason) { setMessage(reason); return; }
    try {
      if (name === "Paste") {
        if (objectClipboard!.objects.some(o => {
          const hash = pictureOf(o);
          return hash !== undefined && !tabPictures.has(hash) || !hosted && isVideo(o) && !tabVideos.has(o.asset);
        })) { setMessage(PASTE_NOT_LOADED); return; }
        const result = buildPaste(model.current, objectClipboard!, {
          centerX: view.x, centerY: view.y, zoom: view.z,
          width: scene.current!.clientWidth, height: scene.current!.clientHeight,
        }, undefined, pages.id, hosted ? null : tabVideos);
        const existing = new Set(model.current.objects.map((o) => o.id));
        const ids = result.board.objects.filter((o) => !existing.has(o.id)).map((o) => o.id);
        commit(result.board, true);
        select(ids);
        setObjectClipboard({ ...objectClipboard!, pasteCount: result.pasteCount });
        setMessage("Pasted " + ids.length + (ids.length === 1 ? " object." : " objects."));
      } else {
        const snapshot = buildSnapshot(model.current, selected, displayedObjects, measureNode)!;
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
  // Adding, collapsing and expanding nodes; each is one step with its layout.
  function mapCommand(name: MapCommand, id?: string) {
    const targetId = id ?? (selected.size === 1 ? [...selected][0] : "");
    const target = model.current.objects.find((o) => o.id === targetId);
    // A root has no sibling: Add sibling on a root does nothing.
    if (!target || !isMindNode(target) || name === "Add sibling" && target.parent === null) return;
    if (commandReason) { setMessage(commandReason); return; }
    finishTextSession();
    const current = model.current, node = current.objects.find((o) => o.id === targetId)!;
    const text = (id: string | null) => current.objects.find((o) => o.id === id && hasText(o)) as { text: string } | undefined;
    if (!isMindNode(node)) return;
    try {
      if (name === "Collapse" || name === "Expand") {
        const next = collapse(current, node.id, name === "Collapse");
        if (next === current) return;
        commit(next, true);
        // Hidden selected nodes leave the selection.
        const hidden = hiddenIds(model.current.objects);
        if ([...selected].some((s) => hidden.has(s))) select([...selected].filter((s) => !hidden.has(s)));
        setMessage(name === "Collapse" ? MAP_WORDS.collapsed(node.text, descendants(current.objects, node.id).length) : MAP_WORDS.expanded(node.text));
        return;
      }
      const result = name === "Add sibling" ? addSibling(current, node.id, measureNode)
        : addChild(current, node.id, measureNode, name === "Add child left" ? "left" : name === "Add child right" ? "right" : undefined);
      if (!result) return;
      commit(result.board, true, undefined, result.id);
      select(result.id);
      setPanel("");
      setInline(true);
      setMessage(name === "Add sibling" ? MAP_WORDS.addedSibling(text(node.parent)!.text) : MAP_WORDS.addedChild(node.text));
    } catch (error) { setMessage(String(error)); }
  }
  function command(name: "Undo" | "Redo" | "Duplicate" | "Delete" | "Cut" | MapCommand, id?: string) {
    if (MAP_COMMANDS.includes(name)) { mapCommand(name as MapCommand, id); return; }
    if (commandReason || name !== "Undo" && name !== "Redo" && selectionReason === TIDY_WAIT) {
      setMessage(commandReason || selectionReason);
      return;
    }
    if ((name === "Duplicate" || name === "Cut") && copiedSetReason(model.current.objects, selected)) {
      setMessage(copiedSetReason(model.current.objects, selected)); return;
    }
    finishTextSession();
    if (hosted && (name === "Undo" || name === "Redo")) {
      hosted.inverse(name === "Undo" ? "undo" : "redo");
      setDrafts({}); setInline(false);
      return;
    }
    try {
      const deleting = name === "Delete" || name === "Cut";
      const acted = name === "Cut" || name === "Duplicate" ? copiedSet(model.current.objects, withHiddenDescendants(model.current.objects, selected)) : selected;
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
        : name === "Duplicate" ? duplicate(model.current, historyRef.current, targets, measureNode)
        : deleteObject(model.current, historyRef.current, targets, measureNode);
      // The step holds the layout of every map the command changes.
      const board = name === "Undo" || name === "Redo" ? result.board : settle(model.current, result.board);
      const steps = board === result.board ? result.history : record(historyRef.current, model.current, board);
      const isHistory = name === "Undo" || name === "Redo";
      const previous = model.current;
      if (!isHistory && steps.past.length) steps.past[steps.past.length - 1] = { ...steps.past.at(-1)!, page: pages.id };
      const hidden = hiddenIds(board.objects);
      const affected = board.objects.filter((o) => o.page === (isHistory && result.page && board.pages?.some(p => p.id === result.page) ? result.page : pages.id) && result.affectedIds.includes(o.id) && !hidden.has(o.id));
      commit(board);
      updateHistory(steps);
      if (isHistory) pages.afterHistory(previous, model.current, result.page);
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
      const target = isHistory && result.affectedIds.length === 1 ? result.affectedId : "";
      const table = [...board.objects, ...previous.objects].find(o => o.id === target && isTable(o));
      if (table) select(board.objects.some(o => o.id === table.id) ? table.id : "");
      else if (isHistory && isDrawingTool(tool)) select([]);
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
  function tableAction(action: TableAction) {
    if (!tableSelection || commandReason) return;
    const t = model.current.objects.find(o => o.id === tableSelection.id);
    if (!t || !isTable(t)) return;
    const anchor = anchorCell(t, tableSelection), index = cellIndex(t, anchor);
    let next = t, nextCell = anchor, hint: TableOrderHint | undefined;
    if (action.at === "clear") {
      if (!cellText(t, anchor)) return;
      next = setCell(t, anchor, "");
    } else {
      const { axis, at } = action, deleting = at === "delete";
      const reason = tableReason(t, axis, deleting ? "delete" : "add");
      if (reason) { setMessage(reason); return; }
      if (deleting) {
        next = deleteAxis(t, axis, anchor[axis]);
        nextCell = cellAt(next, Math.min(index.row, next.rows.length - 1), Math.min(index.column, next.columns.length - 1))!;
      } else {
        const id = crypto.randomUUID();
        next = insertAxis(t, axis, id, at === "end" ? undefined : index[axis] + Number(at === "after"));
        nextCell = { ...anchor, [axis]: id };
        hint = { table: t.id, axis, moved: [id] };
      }
    }
    finishTextSession();
    try {
      commit({ ...model.current, objects: model.current.objects.map(o => o.id === t.id ? boundTable(next) : o) }, true,
        undefined, undefined, undefined, hint);
    } catch (error) { setMessage(String(error)); return; }
    const saved = model.current.objects.find(o => o.id === t.id);
    if (saved && isTable(saved) && saved.rows.some(r => r.id === nextCell.row) && saved.columns.some(c => c.id === nextCell.column))
      chooseTable({ kind: "cell", id: t.id, ...nextCell }, saved);
    scene.current?.focus();
  }
  function tableSize(value: Style["textSize"]) {
    if (commandReason || !tableSelection) return;
    const t = model.current.objects.find(o => o.id === tableSelection.id);
    if (!t || !isTable(t) || t.textSize === value) return;
    commit({ ...model.current, objects: model.current.objects.map(o => o === t ? growTableRows({ ...t, textSize: value }) : o) }, true);
    scene.current?.focus();
  }
  function arrangementReason(name: ArrangeCommand) {
    if (selectionReason === TIDY_WAIT) return selectionReason;
    if (name === "Connect") return editingCommandReason(editingState) ||
      (model.current.objects.some((o) => selected.has(o.id) && isMindNode(o)) ? "Mind map nodes can't be connected." : "") ||
      connectReason(model.current, selected, editingState);
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
      const result = createConnector(current, ideas[0].id, ideas[1].id, connectorStyle.current, pages.id);
      commit(result.board, true); select(result.id); setTool("Select");
      if (native) selector?.current?.focus(); else scene.current?.focus();
    } else if (name === "Section from selection") {
      const result = wrapSelection(current, selected, displayedObjects, pages.id);
      commit(result.board, true);
      select(result.id);
      setTool("Select");
      setPanel(native ? "Objects" : "");
      setInline(!native);
      if (native) setTimeout(() => { editor.current?.focus(); editor.current?.select(); }, 0);
    } else if (name === "Group" || name === "Ungroup") {
      commit(name === "Group" ? groupObjects(current, selected) : ungroupObjects(current, selected), true);
    } else if (isOrderCommand(name)) {
      commit({ ...current, objects: orderInBands(name, current.objects, selected, pages.id) }, true,
        current.objects.filter((o) => selected.has(o.id)).map((o) => o.id));
    } else {
      const positions = new Map(arrangePositions(name, arrangementMembers).map((p) => [p.id, p]));
      commit({ ...current, objects: current.objects.map((o) => positions.has(o.id)
        ? isTable(o) ? boundTable({ ...o, ...positions.get(o.id)! }, displayedObjects.find(d => d.id === o.id)?.displayHeight)
          : { ...o, x: positions.get(o.id)!.x, y: positions.get(o.id)!.y } : o) }, true);
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
    if (selectionReason || key !== "color" && model.current.objects.some((o) => selected.has(o.id) && hasRectangle(o) && !isMedia(o) && !objectType(o.type).richText)) return;
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
    if (selectionReason || model.current.objects.some((o) => selected.has(o.id) && hasRectangle(o) && !isMedia(o) && !objectType(o.type).richText)) return;
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
  const connectorCommands = {
    style: <K extends keyof ConnectorStyle>(key: K, value: ConnectorStyle[K]) => {
      if (selectionReason) return;
      const next = changeConnectorStyle(model.current, selected, key, value);
      if (!selected.size || model.current.objects.filter((o) => selected.has(o.id)).some((o) => !hasEnds(o))) return;
      connectorStyle.current = { ...connectorStyle.current, [key]: value };
      finishTextSession(); setInline(false); commit(next, true);
    },
    reconnect: (id: string, end: "from" | "to", target: End) => {
      if (selectionReason) return;
      finishTextSession(); setInline(false); commit(reconnect(model.current, id, end, target), true);
    },
  };
  const strokeCommands = { pattern: (pattern: TapePattern) => {
    if (selectionReason) return;
    const objects=model.current.objects.map(o=>isTape(o)&&selected.has(o.id)&&o.pattern!==pattern?{...o,pattern}:o);
    finishTextSession();setInline(false);commit({...model.current,objects},true);
  }, color: strokeColor, weight: strokeWeight };
  const shapeCommands = { changeShape, changeFill: changeShapeFill, changeBorder: changeShapeBorder, grow };
  return { tableData, tableAction, tableSize, connectorCommands, strokeCommands, loadTemplates, templateCommands, templatePreviews, shapeCommands, setSection, objectClipboard, command, clipboardCommand, arrangementReason, arrange, changeStyle, toggleFormat };
}
