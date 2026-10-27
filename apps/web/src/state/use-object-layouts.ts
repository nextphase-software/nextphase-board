// SPDX-License-Identifier: Apache-2.0
import { useMemo, type RefObject } from "react";
import Konva from "konva";
import type { BoardV6 as Board, ItemV6 as Item } from "../document";
import { allowedHeight, displayHeight, neededHeight, TEXT_INSET, TEXT_LAYOUT } from "../geometry";
import { objectType, textBox, usesShapePaint, shapeTextLayout, fitHeight, canGrow } from "../objects/registry";
import { groupNumbers, wholeGroups } from "../group";
import { cornerPoint, type Corner } from "../resize";
import { boundingBox } from "../selection";
import { textUnits } from "../styles";
import { remap } from "../marks";
import { layoutRuns, type RunStyle, type RunLine } from "../text-runs";
import type { Drag } from "../gesture";

const CORNERS: Corner[] = ["nw", "ne", "sw", "se"];

type Input = {
  board: Board;
  selected: Set<string>;
  selectedId: string;
  item: Item | undefined;
  text: string;
  inline: boolean;
  textEditing: boolean;
  invalidObjectText: boolean;
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
  return marks.length || usesShapePaint(object) ? layoutRuns(text, marks, textBox(object).width,
    (value, style) => measure(value, style, textUnits(object.textSize))) : null;
}
function lineCount(object: Item, text = object.text): number {
  const runs = runLines(object, text);
  if (runs) return Math.max(1, runs.length);
  // Auto height is essential here: a fixed height would count only visible lines.
  const measurement = new Konva.Text({
    ...TEXT_LAYOUT,
    fontSize: textUnits(object.textSize),
    width: textBox(object).width,
    text,
  });
  const lines = Math.max(1, measurement.textArr.length);
  measurement.destroy();
  return lines;
}

export function useObjectLayouts({
  board, selected, selectedId, item, text, inline, textEditing, invalidObjectText, tool, readOnly, composing, busy, drag,
}: Input) {
  const objectLayouts = useMemo(() => new Map(board.objects.map((o): [string, { height: number; runs: RunLine[] | null; limited: boolean; fadeStart: number; fadeEnd: number; fits?: boolean; fitHeight?: number }] => {
    if (!objectType(o.type).richText) return [o.id, { height: o.height, runs: null,
      limited: false, fadeStart: 0, fadeEnd: 0 }];
    // Uncommitted composition/invalid input may grow the editor's preview only.
    if (usesShapePaint(o)) {
      const layout = (width: number) => layoutRuns(o.text, o.marks, width, (value, style) => measure(value, style, textUnits(o.textSize)));
      const measured = shapeTextLayout(o, layout, (value, style) => measure(value, style, textUnits(o.textSize)));
      return [o.id, { height: o.height, runs: measured.lines, fits: measured.fits,
        fitHeight: measured.fits ? o.height : fitHeight(o, layout, (value, style) => measure(value, style, textUnits(o.textSize))),
        limited: !measured.fits, fadeStart: 0, fadeEnd: 0 }];
    }
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
  const handlesVisible = !!bounds && tool === "Select" && !readOnly && (!inline || !!item && !objectType(item.type).richText) && !composing &&
    (!busy || !!drag.current?.corner);
  const handlePoints = bounds ? CORNERS.map((corner) => ({
    corner, ...cornerPoint(corner, bounds),
  })) : [];
  const itemLayout = item ? objectLayouts.get(item.id) : undefined;
  const growHeight = itemLayout?.fitHeight ?? 0;
  const growAvailable = !!item && canGrow(selected.size === 1, usesShapePaint(item),
    itemLayout?.fits ?? true, item.height, growHeight,
    readOnly || composing || busy || inline || textEditing || invalidObjectText ? "Unavailable while editing" : "");
  const itemHeight = item ? objectLayouts.get(item.id)!.height : 0;
  return {
    growHeight, growAvailable, lineCount, objectLayouts, displayedObjects, bounds, selectedGroups, numbers,
    handlesVisible, handlePoints, itemHeight,
  };
}
