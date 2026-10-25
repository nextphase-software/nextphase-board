// SPDX-License-Identifier: Apache-2.0
import { useMemo, type RefObject } from "react";
import Konva from "konva";
import type { BoardV3 as Board, ItemV3 as Item } from "../document";
import { allowedHeight, displayHeight, neededHeight, TEXT_INSET, TEXT_LAYOUT } from "../geometry";
import { groupNumbers, wholeGroups } from "../group";
import { type Corner, type Rectangle } from "../resize";
import { boundingBox } from "../selection";
import { textUnits } from "../styles";
import type { View } from "../view";

const CORNERS: Corner[] = ["nw", "ne", "sw", "se"];
type ResizeStart = { object: Item; rectangle: Rectangle };

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
  drag: RefObject<
    {
      id: string;
      ids?: string[];
      previous?: string[];
      box?: boolean;
      additive?: boolean;
      corner?: Corner;
      resizeStart?: ResizeStart[];
      crossed?: boolean;
      x: number;
      y: number;
      cx: number;
      cy: number;
      view: View;
      pan: boolean;
      temporary?: boolean;
      pointerId?: number;
      cancelled?: boolean;
    } | null
  >;
};

function lineCount(object: Item, text = object.text): number {
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
    corner, ...posForCorner(corner, bounds),
  })) : [];
  function posForCorner(corner: Corner, rectangle: Rectangle) {
    return {
      x: rectangle.x + (corner.endsWith("e") ? rectangle.width : 0),
      y: rectangle.y + (corner.startsWith("s") ? rectangle.height : 0),
    };
  }
  const itemHeight = item ? objectLayouts.get(item.id)!.height : 0;
  return {
    lineCount, objectLayouts, displayedObjects, bounds, selectedGroups, numbers,
    handlesVisible, handlePoints, itemHeight,
  };
}
