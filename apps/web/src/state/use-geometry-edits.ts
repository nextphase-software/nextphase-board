// SPDX-License-Identifier: Apache-2.0
import type { Dispatch, RefObject, SetStateAction } from "react";
import { add, type Board as SavedBoard, type BoardV8 as Board, type ItemV8 as Item, validText } from "../document";
import { neededHeight, savedHeight } from "../geometry";
import { moveWithMembers, placeObject } from "../sections";
import { objectType, rectangleType, hasText, hasPoints, hasRectangle, creationValues, typeForTool, type ShapePaint } from "../objects/registry";
import { resizeObject, resizeSet, type Corner, type Rectangle } from "../resize";
import { resizeWithStrokes } from "../strokes";
import { remap } from "../marks";
import { textUnits } from "../styles";

import type { ResizeStart } from "../gesture";

type Input = {
  shapeSession: { paint: RefObject<ShapePaint> };
  model: RefObject<Board>;
  commit: (input: SavedBoard, recordObject?: boolean, orderIds?: readonly string[]) => void;
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
};

export function useGeometryEdits({
  shapeSession, model, commit, beginTextSession, finishTextSession, setDrafts, setMessage,
  item, selected, select, objectLayouts, readOnly, busy, composing,
  setStatus, setTool, setPanel, setInline, editor, lineCount,
}: Input) {
  function commitText(id: string, value: string) {
    commit({
      ...model.current,
      objects: model.current.objects.map((o) =>
        o.id === id && hasText(o) && o.text !== value
          ? { ...o, ...(hasRectangle(o) ? { height: objectType(o.type).growsWithText ? savedHeight(o, lineCount(o, value), textUnits(o.textSize)) : o.height } : {}), text: value, marks: remap(o.marks, o.text, value) }
          : o
      ),
    });
  }
  function changeText(value: string) {
    if (!item || !hasText(item) || readOnly) return;
    beginTextSession(item);
    setDrafts((d) => ({ ...d, [item.id]: value }));
    setStatus("Unsaved");
    if (validText(value, objectType(item.type).textLimit) && !composing) {
      commitText(item.id, value);
    }
  }
  function create(tool: string, x: number, y: number, native = false) {
    if (readOnly || busy || composing) return;
    try {
      const type = typeForTool(tool);
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
  function movedBoard(ids: string[], dx: number, dy: number) {
    return moveWithMembers(model.current, new Set(ids), dx, dy);
  }
  function move(dx: number, dy: number) {
    if (!selected.size || readOnly || composing || busy) return;
    const next = movedBoard([...selected], dx, dy);
    if (next !== model.current) commit(next, true);
  }

  function resizeStart(): ResizeStart[] {
    return model.current.objects.filter(hasRectangle).filter((o) => selected.has(o.id)).map((object) => ({
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
    if (start.some(({ object }) => hasPoints(object))) {
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
