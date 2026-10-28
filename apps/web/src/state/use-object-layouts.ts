// SPDX-License-Identifier: Apache-2.0
import { useMemo, type RefObject } from "react";
import Konva from "konva";
import type { BoardV8 as Board, ItemV8 as Item, ResolvedItem } from "../document";
import { allowedHeight, displayHeight, neededHeight, TEXT_INSET, TEXT_LAYOUT } from "../geometry";
import { objectType, textBox, hasText, usesShapePaint, shapeTextLayout, fitHeight, canGrow, hasRectangle, hasEnds } from "../objects/registry";
import { groupNumbers, wholeGroups } from "../group";
import { cornerPoint, type Corner } from "../resize";
import { boundingBox } from "../selection";
import { textUnits } from "../styles";
import { remap } from "../marks";
import { layoutRuns, type RunStyle, type RunLine } from "../text-runs";
import type { Drag } from "../gesture";

import { connectorLayout, labelEditorBox, type ConnectorLayout } from "../connectors";

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
function runLines(object: Item, text = object.text ?? "") {
  if (!hasRectangle(object) || !hasText(object)) return null;
  const marks = text === object.text ? object.marks : remap(object.marks, object.text, text);
  return marks.length || usesShapePaint(object) ? layoutRuns(text, marks, textBox(object).width,
    (value, style) => measure(value, style, textUnits(object.textSize))) : null;
}
function lineCount(object: Item, text = object.text ?? ""): number {
  if (!hasText(object)) return 0;
  if (!hasRectangle(object)) return text.split(/\r\n|[\r\n]/).length;
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
  const objectLayouts = useMemo(() => {
    const layouts = new Map(board.objects.filter(hasRectangle).map((o): [string, { height: number; runs: RunLine[] | null; limited: boolean; fadeStart: number; fadeEnd: number; fits?: boolean; fitHeight?: number; connector?: ConnectorLayout }] => {
    if (!hasText(o) || !objectType(o.type).richText) return [o.id, { height: o.height, runs: null,
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
    }));
    const rectangles = new Map(board.objects.filter(hasRectangle).map((o) => [o.id, { ...o, displayHeight: layouts.get(o.id)!.height }]));
    for (const o of board.objects.filter(hasEnds)) {
      const connector = connectorLayout(o, rectangles, (value) => measure(value, {}, 18));
      layouts.set(o.id, { height: connector.bounds.height, connector, runs: null, limited: false, fadeStart: 0, fadeEnd: 0 });
    }
    return layouts;
  }, [board.objects, inline, selectedId, text]);
  const displayedObjects: ResolvedItem[] = board.objects.map((o) => {
    const layout = objectLayouts.get(o.id)!;
    return { ...o, ...(layout.connector?.bounds ?? {}), connectorLayout: layout.connector, displayHeight: layout.height } as ResolvedItem;
  });
  const resolvedItem = displayedObjects.find((o) => o.id === selectedId);
  const editorBox = resolvedItem && hasEnds(resolvedItem) ? labelEditorBox(resolvedItem.connectorLayout!.labelPoint, text) : undefined;
  const rectanglesSelected = displayedObjects.filter((o) => selected.has(o.id) && hasRectangle(o));
  const bounds = boundingBox(rectanglesSelected.length ? rectanglesSelected : displayedObjects.filter((o) => selected.has(o.id)));
  const selectedGroups = wholeGroups(displayedObjects, selected);
  const numbers = groupNumbers(board.objects);
  const handlesVisible = rectanglesSelected.length > 0 && !!bounds && tool === "Select" && !readOnly && (!inline || !!item && !objectType(item.type).richText) && !composing &&
    (!busy || !!drag.current?.corner);
  const handlePoints = bounds ? CORNERS.map((corner) => ({
    corner, ...cornerPoint(corner, bounds),
  })) : [];
  const itemLayout = item ? objectLayouts.get(item.id) : undefined;
  const growHeight = itemLayout?.fitHeight ?? 0;
  const growAvailable = !!item && canGrow(selected.size === 1, usesShapePaint(item),
    itemLayout?.fits ?? true, hasRectangle(item) ? item.height : 0, growHeight,
    readOnly || composing || busy || inline || textEditing || invalidObjectText ? "Unavailable while editing" : "");
  const itemHeight = item ? objectLayouts.get(item.id)!.height : 0;
  return {
    editorBox, resolvedItem, growHeight, growAvailable, lineCount, objectLayouts, displayedObjects, bounds, selectedGroups, numbers,
    handlesVisible, handlePoints, itemHeight,
  };
}
