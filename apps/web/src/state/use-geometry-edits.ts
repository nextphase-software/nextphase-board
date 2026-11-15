// SPDX-License-Identifier: Apache-2.0
import type { Dispatch, RefObject, SetStateAction } from "react";
import { add, type Board as SavedBoard, type BoardV12 as Board, type ItemV12 as Item, validText } from "nextphase-board-rules/document.ts";
import { neededHeight, savedHeight } from "../geometry";
import { moveWithMembers, placeObject } from "../sections";
import { isTape, objectType, rectangleType, hasText, keepsProportions, hasRectangle, creationValues, typeForTool, isMindNode, type ShapePaint } from "nextphase-board-rules/objects/registry.ts";
import { detach, dragPreview, outerSide, reparent, starterMap, type MeasureNode, type Side } from "../mind-map";
import { resizeObject, resizeSet, type Corner, type Rectangle } from "../resize";
import { resizeWithStrokes } from "../strokes";
import { remap } from "nextphase-board-rules/marks.ts";
import { textUnits } from "nextphase-board-rules/styles.ts";

import type { NodeDrop, ResizeStart } from "../gesture";

type Input = {
  shapeSession: { paint: RefObject<ShapePaint> };
  model: RefObject<Board>;
  commit: (input: SavedBoard, recordObject?: boolean, orderIds?: readonly string[], opens?: string) => void;
  beginTextSession: (item: Item | undefined) => void;
  finishTextSession: () => void;
  setDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  setMessage: (value: string) => void;
  item: Item | undefined;
  selected: Set<string>;
  select: (value: string | Iterable<string>) => void;
  objectLayouts: Map<string, { height: number; limited: boolean; fadeStart: number; fadeEnd: number }>;
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
  shapeSession, model, commit, beginTextSession, finishTextSession, setDrafts, setMessage,
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
  function create(tool: string, x: number, y: number, native = false, released = false) {
    if (readOnly || busy && !released || composing) return;
    try {
      const type = typeForTool(tool);
      if (isMindNode({ type })) {
        // The starter map opens its root with all text selected.
        const result = starterMap(model.current, { x, y }, measureNode);
        commit(result.board, true, undefined, result.id);
        select(result.id);
        setTool("Select");
        setPanel("");
        setInline(true);
        setTimeout(() => editor.current?.select(), 0);
        return;
      }
      const object = creationValues(add(model.current, type, x, y).objects.at(-1)!, tool, shapeSession.paint.current);
      const next = placeObject(model.current, object);
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
  function movedBoard(ids: string[], dx: number, dy: number, drop?: NodeDrop) {
    const node = ids.length === 1 && drop ? model.current.objects.find((o) => o.id === ids[0] && isMindNode(o)) : undefined;
    if (!node || !isMindNode(node)) return moveWithMembers(model.current, new Set(ids), dx, dy);
    if (drop!.preview) return dragPreview(model.current, node.id, dx, dy);
    const { target, side } = drop as { target: string | null; side: Side };
    if (target) return reparent(model.current, node.id, target, side, measureNode);
    if (node.parent === null) return moveWithMembers(model.current, new Set(ids), dx, dy);
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
    if (start.some(({ object }) => keepsProportions(object))) {
      const objects = resizeWithStrokes(corner, start, { x: dx, y: dy }, (o, width) => hasText(o) && objectType(o.type).growsWithText
        ? neededHeight(lineCount({ ...o, width }), textUnits(o.textSize)) : 0);
      const changes = new Map(objects.map((o) => [o.id, o]));
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
    const changes = new Map(start.map(({ object }, i) => [object.id, geometry[i]]));
    return { ...model.current, objects: model.current.objects.map((o) =>
      changes.has(o.id) ? { ...o, ...changes.get(o.id)! } : o) };
  }
  function resizeBy(dx: number, dy: number) {
    if (!selected.size || readOnly || composing || busy) return;
    finishTextSession();
    const start = resizeStart();
    if (start.length) commit(resizedBoard("se", start, dx, dy, false), true);
  }
  return {
    commitText, changeText, create, movedBoard, move, resizeStart,
    resizeStillValid, resizedBoard, resizeBy,
  };
}
