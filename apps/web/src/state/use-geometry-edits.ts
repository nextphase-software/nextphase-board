// SPDX-License-Identifier: Apache-2.0
import type { Dispatch, RefObject, SetStateAction } from "react";
import { add, type Board as SavedBoard, type BoardV14 as Board, type ItemV14 as Item, type TableItem, validText } from "nextphase-board-rules/document.ts";
import { neededHeight, savedHeight } from "../geometry";
import { moveWithMembers, placeObject } from "../sections";
import { isTape, isTable, cellText, setCell, validCellText, resizeAxis, scaleTable, type CellAddress, objectType, rectangleType, hasText, keepsProportions, hasRectangle, creationValues, typeForTool, isMindNode, type ShapePaint } from "nextphase-board-rules/objects/registry.ts";
import { detach, dragPreview, outerSide, reparent, starterMap, type MeasureNode, type Side } from "../mind-map";
import { resizeObject, resizeSet, type Corner, type Rectangle } from "../resize";
import { resizeWithStrokes } from "../strokes";
import { remap } from "nextphase-board-rules/marks.ts";
import { textUnits } from "nextphase-board-rules/styles.ts";

import type { NodeDrop, ResizeStart } from "../gesture";

import type { TableOrderHint } from "nextphase-board-sync/document-adapter.ts";
import { boundTable, cellBox, TABLE_INSET, tableCorner, type CellSelection, type TableBorder, type MeasureCell, type TableLayout } from "../table";
import { rebaseComposition, type TableEntry } from "../table";

type Input = {
  tableEntry: TableEntry;
  tableMeasure: MeasureCell;
  growTableRows: (value: TableItem) => TableItem;
  chooseTable: (selection: CellSelection, table: TableItem) => void;
  revealCell: (box: Rectangle) => void;
  page: string;
  shapeSession: { paint: RefObject<ShapePaint> };
  model: RefObject<Board>;
  commit: (input: SavedBoard, recordObject?: boolean, orderIds?: readonly string[], opens?: string, movedPages?: readonly string[], tableHint?: TableOrderHint) => void;
  beginTextSession: (item: Item | undefined) => void;
  finishTextSession: () => void;
  setDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setMessage: (value: string) => void;
  item: Item | undefined;
  selected: Set<string>;
  select: (value: string | Iterable<string>) => void;
  objectLayouts: Map<string, { height: number; limited: boolean; fadeStart: number; fadeEnd: number; table?: TableLayout }>;
  readOnly: boolean;
  busy: boolean;
  composing: boolean;
  setStatus: Dispatch<SetStateAction<string>>;
  setTool: Dispatch<SetStateAction<string>>;
  setPanel: Dispatch<SetStateAction<string>>;
  setInline: Dispatch<SetStateAction<boolean>>;
  editor: RefObject<HTMLTextAreaElement | null>;
  lineCount: (object: Item, text?: string) => number;
  measureNode: MeasureNode;
};

export function useGeometryEdits({
  tableEntry, tableMeasure, growTableRows, chooseTable, revealCell, page, shapeSession, model, commit, beginTextSession, finishTextSession, setDrafts, setMessage,
  item, selected, select, objectLayouts, readOnly, busy, composing,
  setStatus, setTool, setPanel, setInline, editor, lineCount, measureNode,
}: Input) {
  // Each keystroke writes a node's measured box, grown from a fixed corner: the
  // left and top edges, or the right and top edges for a left-side node.
  function nodeBox(o: Item, value: string) {
    if (!isMindNode(o)) return {};
    const box = measureNode(value, o.parent === null);
    return { ...box, x: outerSide(model.current.objects, o.id) === "left" ? o.x + o.width - box.width : o.x };
  }
  function commitText(id: string, value: string) {
    commit({
      ...model.current,
      objects: model.current.objects.map((o) =>
        o.id === id && hasText(o) && o.text !== value
          ? { ...o, ...(hasRectangle(o) ? { height: objectType(o.type).growsWithText ? savedHeight(o, lineCount(o, value), textUnits(o.textSize)) : o.height } : {}), ...nodeBox(o, value), text: value, marks: remap(o.marks, o.text, value) }
          : o
      ),
    });
  }
  function changeText(input: string) {
    if (!item || !hasText(item) || readOnly) return;
    // A node has no line breaks: pasted ones become spaces.
    const value = isMindNode(item) ? input.replace(/\r\n|[\n\r\u2028\u2029]/g, " ") : input;
    beginTextSession(item);
    setDrafts((d) => ({ ...d, [item.id]: value }));
    setStatus("Unsaved");
    if (validText(value, objectType(item.type).textLimit) && !composing) {
      commitText(item.id, value);
    }
  }
  function create(tool: string, x: number, y: number, native = false, released = false, dimensions?: { columns: number; rows: number }) {
    if (readOnly || busy && !released || composing) return;
    try {
      const type = typeForTool(tool);
      if (isMindNode({ type })) {
        // The starter map opens its root with all text selected.
        const result = starterMap(model.current, { x, y }, measureNode, page);
        commit(result.board, true, undefined, result.id);
        select(result.id);
        setTool("Select");
        setPanel("");
        setInline(true);
        setTimeout(() => editor.current?.select(), 0);
        return;
      }
      const object = creationValues(add(model.current, type, x, y, page, dimensions).objects.at(-1)!, tool, shapeSession.paint.current);
      const next = placeObject(model.current, object, objectLayouts);
      if (isTable(object)) {
        commit(next, true); select(object.id); setTool("Select"); setPanel(""); return;
      }
      commit(next, true);
      select(object.id);
      setTool("Select");
      setPanel(native ? "Objects" : "");
      setInline(!native);
      if (native) setTimeout(() => {
        editor.current?.focus();
        if (!objectType(type).richText) editor.current?.select();
      }, 0);
    } catch (e) {
      setMessage(String(e));
    }
  }
  function editCell(table: TableItem, at: CellAddress) {
    if (readOnly || busy || composing) return;
    const layout = objectLayouts.get(table.id)?.table, box = layout && cellBox(table, layout, at);
    if (!box) return;
    const cell: CellSelection = { kind: "cell", id: table.id, ...at };
    finishTextSession();
    chooseTable(cell, table);
    revealCell({ x: box.x + TABLE_INSET, y: box.y + TABLE_INSET, width: box.width - 2 * TABLE_INSET, height: box.height - 2 * TABLE_INSET });
    setPanel(""); tableEntry.setDraft({ cell, text: cellText(table, at) }); setInline(true);
  }
  function changeCell(value: string, composingNow = composing) {
    const draft = tableEntry.draft;
    const table = model.current.objects.find(o => o.id === draft?.cell.id);
    if (!draft || !table || !isTable(table) || readOnly) return;
    tableEntry.setDraft({ ...draft, text: value });
    if (!composingNow && validCellText(value)) {
      const updated = setCell(table, draft.cell, value);
      if (updated === table) return;
      beginTextSession(table);
      commit({ ...model.current, objects: model.current.objects.map(o => o.id === table.id ? growTableRows(updated) : o) });
    }
  }
  function finishCellComposition(value: string, inserted: string) {
    const composition = tableEntry.composition.current, draft = tableEntry.draft;
    tableEntry.composition.current = null;
    const live = model.current.objects.find(o => o.id === draft?.cell.id);
    if (!draft || !live || !isTable(live)) return;
    if (!composition?.changed) { changeCell(value, false); return; }
    const result = rebaseComposition(composition.base, cellText(live, draft.cell), composition.offset, inserted);
    changeCell(result.text, false);
    requestAnimationFrame(() => editor.current?.setSelectionRange(result.caret, result.caret));
  }
  function resizedTableBorder(table: TableItem, border: TableBorder, start: TableLayout, delta: number) {
    const axis = border.axis, row = axis === "row";
    const size = row ? start.rows[border.index] : table.columns[border.index].width;
    const minimum = row ? Math.min(1000, start.minimums[border.index]) : 64;
    const next = resizeAxis(table, axis, border.id, Math.max(minimum, size + delta));
    return row ? boundTable(next) : growTableRows(next);
  }
  function movedBoard(ids: string[], dx: number, dy: number, drop?: NodeDrop) {
    const node = ids.length === 1 && drop ? model.current.objects.find((o) => o.id === ids[0] && isMindNode(o)) : undefined;
    if (!node || !isMindNode(node)) return moveWithMembers(model.current, new Set(ids), dx, dy, objectLayouts);
    if (drop!.preview) return dragPreview(model.current, node.id, dx, dy);
    const { target, side } = drop as { target: string | null; side: Side };
    if (target) return reparent(model.current, node.id, target, side, measureNode);
    if (node.parent === null) return moveWithMembers(model.current, new Set(ids), dx, dy, objectLayouts);
    return detach(model.current, node.id, { x: node.x + dx + node.width / 2, y: node.y + dy + node.height / 2 }, measureNode);
  }
  function move(dx: number, dy: number) {
    if (!selected.size || readOnly || composing || busy) return;
    const next = movedBoard([...selected], dx, dy);
    if (next !== model.current) commit(next, true);
  }

  function resizeStart(): ResizeStart[] {
    return model.current.objects.filter(hasRectangle).filter((o) => !isTape(o)).filter((o) => selected.has(o.id)).map((object) => ({
      object, rectangle: { x: object.x, y: object.y, width: object.width,
        height: objectLayouts.get(object.id)!.height },
    }));
  }
  function resizeStillValid(start: ResizeStart[]) {
    return start.every(({ object }) => {
      const live = model.current.objects.find((o) => o.id === object.id);
      return live && hasRectangle(live) && live.generation === object.generation && live.x === object.x &&
        live.y === object.y && live.width === object.width && live.height === object.height;
    });
  }
  function resizedBoard(corner: Corner, start: ResizeStart[], dx: number, dy: number, shift: boolean) {
    if (model.current.objects.some(o => selected.has(o.id) && isTape(o))) return model.current;
    function scaled(o: TableItem, base: Rectangle, next: Rectangle) {
      return tableCorner(growTableRows(scaleTable(o, next.width / base.width, next.height / base.height)),
        base, next, corner, start.length === 1, tableMeasure);
    }
    if (start.some(({ object }) => keepsProportions(object))) {
      const objects = resizeWithStrokes(corner, start, { x: dx, y: dy }, (o, width) => hasText(o) && objectType(o.type).growsWithText
        ? neededHeight(lineCount({ ...o, width }), textUnits(o.textSize)) : 0);
      const changes = new Map(objects.map((o, i) => {
        const source = start[i]?.object;
        return [o.id, source && isTable(source) ? scaled(source, start[i].rectangle, o) : o] as const;
      }));
      return { ...model.current, objects: model.current.objects.map((o) => changes.get(o.id) ?? o) };
    }
    const members = start.map(({ object, rectangle }) => ({ ...rectangle, sizeRange: rectangleType(object.type).sizeRange,
      neededHeight: (width: number) => hasText(object) && objectType(object.type).growsWithText ? neededHeight(lineCount({ ...object, width }), textUnits(object.textSize)) : 0,
    }));
    const geometry = members.length === 1
      ? [resizeObject(corner, start[0].rectangle, { x: dx, y: dy }, shift, members[0].neededHeight, members[0].sizeRange)]
      : resizeSet(corner, members, { x: dx, y: dy }, shift);
    // Starting drawn heights may exceed saved heights. An unchanged resize saves nothing.
    if (geometry.every((g, i) => Object.keys(g).every((key) =>
      g[key as keyof Rectangle] === start[i].rectangle[key as keyof Rectangle]))) return model.current;
    const changes = new Map(start.map(({ object, rectangle }, i) => [object.id, isTable(object) ? scaled(object, rectangle, geometry[i]) : { ...object, ...geometry[i] }]));
    return { ...model.current, objects: model.current.objects.map((o) =>
      changes.get(o.id) ?? o) };
  }
  function resizeBy(dx: number, dy: number) {
    if (!selected.size || readOnly || composing || busy) return;
    finishTextSession();
    const start = resizeStart();
    if (start.length) commit(resizedBoard("se", start, dx, dy, false), true);
  }
  return {
    tableGeometry: { editCell, changeCell, finishCellComposition, resizedTableBorder }, commitText, changeText, create, movedBoard, move, resizeStart,
    resizeStillValid, resizedBoard, resizeBy,
  };
}
