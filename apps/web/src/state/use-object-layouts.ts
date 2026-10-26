// SPDX-License-Identifier: Apache-2.0
import { useMemo, type RefObject } from "react";
import Konva from "konva";
import type { BoardV5 as Board, ItemV5 as Item } from "../document";
import { allowedHeight, displayHeight, neededHeight, TEXT_INSET, TEXT_LAYOUT } from "../geometry";
import { groupNumbers, wholeGroups } from "../group";
import { cornerPoint, type Corner } from "../resize";
import { boundingBox } from "../selection";
import { textUnits } from "../styles";
import { remap } from "../marks";
import { layoutRuns, type RunStyle } from "../text-runs";
import type { Drag } from "../gesture";

const CORNERS: Corner[] = ["nw", "ne", "sw", "se"];

type Input = {
  board: Board;
  selected: Set<string>;
  selectedId: string;
  item: Item | undefined;
  text: string;
  inline: boolean;
  tool: string;
  readOnly: boolean;
  composing: boolean;
  busy: boolean;
  drag: RefObject<Drag | null>;
};

const measurements = new Map<string, Konva.Text>();
function measure(text: string, style: RunStyle, fontSize: number): number {
  const fontStyle = style.italic ? style.bold ? "italic bold" : "italic" : style.bold ? "bold" : "normal";
  const key = fontStyle + ":" + fontSize;
  let measurement = measurements.get(key);
  if (!measurement) {
    measurement = new Konva.Text({ ...TEXT_LAYOUT, fontStyle, fontSize });
    measurements.set(key, measurement);
  }
  return measurement.measureSize(text).width;
}
function runLines(object: Item, text = object.text) {
  const marks = text === object.text ? object.marks : remap(object.marks, object.text, text);
  return marks.length ? layoutRuns(text, marks, object.width - 2 * TEXT_INSET,
    (value, style) => measure(value, style, textUnits(object.textSize))) : null;
}
function lineCount(object: Item, text = object.text): number {
  const runs = runLines(object, text);
  if (runs) return Math.max(1, runs.length);
  // Auto height is essential here: a fixed height would count only visible lines.
  const measurement = new Konva.Text({
    ...TEXT_LAYOUT,
    fontSize: textUnits(object.textSize),
    width: object.width - 2 * TEXT_INSET,
    text,
  });
  const lines = Math.max(1, measurement.textArr.length);
  measurement.destroy();
  return lines;
}

export function useObjectLayouts({
  board, selected, selectedId, item, text, inline, tool, readOnly, composing, busy, drag,
}: Input) {
  const objectLayouts = useMemo(() => new Map(board.objects.map((o) => {
    // Uncommitted composition/invalid input may grow the editor's preview only.
    const lines = lineCount(o, inline && o.id === selectedId ? text : o.text);
    const fontSize = textUnits(o.textSize);
    const height = displayHeight(o, lines, fontSize);
    const innerHeight = height - 2 * TEXT_INSET;
    const lineHeight = fontSize * TEXT_LAYOUT.lineHeight;
    const visibleLines = Math.floor(innerHeight / lineHeight);
    return [o.id, {
      height,
      runs: runLines(o),
      limited: neededHeight(lines, fontSize) > allowedHeight(o.y),
      fadeStart: Math.max(0, visibleLines - 1) * lineHeight,
      fadeEnd: Math.max(1, Math.min(innerHeight, Math.max(1, visibleLines) * lineHeight)),
    }];
  })), [board.objects, inline, selectedId, text]);
  const displayedObjects = board.objects.map((o) => ({ ...o, displayHeight: objectLayouts.get(o.id)!.height }));
  const bounds = boundingBox(displayedObjects.filter((o) => selected.has(o.id)));
  const selectedGroups = wholeGroups(displayedObjects, selected);
  const numbers = groupNumbers(board.objects);
  const handlesVisible = !!bounds && tool === "Select" && !readOnly && !inline && !composing &&
    (!busy || !!drag.current?.corner);
  const handlePoints = bounds ? CORNERS.map((corner) => ({
    corner, ...cornerPoint(corner, bounds),
  })) : [];
  const itemHeight = item ? objectLayouts.get(item.id)!.height : 0;
  return {
    lineCount, objectLayouts, displayedObjects, bounds, selectedGroups, numbers,
    handlesVisible, handlePoints, itemHeight,
  };
}
