// SPDX-License-Identifier: Apache-2.0
import type { Dispatch, RefObject, SetStateAction } from "react";
import { add, type Board as SavedBoard, type BoardV3 as Board, type ItemV3 as Item, validText } from "../document";
import { neededHeight, savedHeight } from "../geometry";
import { limitMove } from "../selection";
import { resizeObject, resizeSet, type Corner, type Rectangle } from "../resize";
import { textUnits } from "../styles";

import type { ResizeStart } from "../gesture";

type Input = {
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
  model, commit, beginTextSession, finishTextSession, setDrafts, setMessage,
  item, selected, select, objectLayouts, readOnly, busy, composing,
  setStatus, setTool, setPanel, setInline, editor, lineCount,
}: Input) {
  function commitText(id: string, value: string) {
    commit({
      ...model.current,
      objects: model.current.objects.map((o) =>
        o.id === id && o.text !== value
          ? { ...o, text: value, height: savedHeight(o, lineCount(o, value), textUnits(o.textSize)) }
          : o
      ),
    });
  }
  function changeText(value: string) {
    if (!item || readOnly) return;
    beginTextSession(item);
    setDrafts((d) => ({ ...d, [item.id]: value }));
    setStatus("Unsaved");
    if (validText(value, 1000) && !composing) {
      commitText(item.id, value);
    }
  }
  function create(type: Item["type"], x: number, y: number, native = false) {
    if (readOnly || busy || composing) return;
    try {
      const next = add(model.current, type, x, y);
      commit(next, true);
      select(next.objects.at(-1)!.id);
      setTool("Select");
      setPanel(native ? "Objects" : "");
      setInline(!native);
      if (native) setTimeout(() => editor.current?.focus(), 0);
    } catch (e) {
      setMessage(String(e));
    }
  }
  function movedBoard(ids: string[], dx: number, dy: number) {
    const members = model.current.objects.filter((o) => ids.includes(o.id));
    const delta = limitMove(members, { x: dx, y: dy });
    return { ...model.current, objects: model.current.objects.map((o) => ids.includes(o.id)
      ? { ...o, x: o.x + delta.x, y: o.y + delta.y } : o) };
  }
  function move(dx: number, dy: number) {
    if (!selected.size || readOnly || composing || busy) return;
    commit(movedBoard([...selected], dx, dy), true);
  }
  function resizeStart(): ResizeStart[] {
    return model.current.objects.filter((o) => selected.has(o.id)).map((object) => ({
      object, rectangle: { x: object.x, y: object.y, width: object.width,
        height: objectLayouts.get(object.id)!.height },
    }));
  }
  function resizeStillValid(start: ResizeStart[]) {
    return start.every(({ object }) => {
      const live = model.current.objects.find((o) => o.id === object.id);
      return live && live.generation === object.generation && live.x === object.x &&
        live.y === object.y && live.width === object.width && live.height === object.height;
    });
  }
  function resizedBoard(corner: Corner, start: ResizeStart[], dx: number, dy: number, shift: boolean) {
    const members = start.map(({ object, rectangle }) => ({ ...rectangle,
      neededHeight: (width: number) => neededHeight(lineCount({ ...object, width }), textUnits(object.textSize)),
    }));
    const geometry = members.length === 1
      ? [resizeObject(corner, start[0].rectangle, { x: dx, y: dy }, shift, members[0].neededHeight)]
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
    commit(resizedBoard("se", resizeStart(), dx, dy, false), true);
  }
  return {
    commitText, changeText, create, movedBoard, move, resizeStart,
    resizeStillValid, resizedBoard, resizeBy,
  };
}
