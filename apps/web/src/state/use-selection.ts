// SPDX-License-Identifier: Apache-2.0
import { useState } from "react";
import type { BoardV9 as Board } from "../document";
import { count } from "../document";
import { FLAGS, formatted, formattedRange, type Flag, type TextSelection } from "../marks";
import { objectType, hasText, hasPoints, usesShapePaint, commonShapeValue, hasRectangle, hasEnds } from "../objects/registry";
import { colorEntry, commonStyle } from "../styles";

type Input = {
  board: Board;
  drafts: Record<string, string>;
  textSelection: TextSelection | null;
};

export function useSelection({ board, drafts, textSelection }: Input) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const selectedObjects = board.objects.filter((o) => selected.has(o.id));
  const ideas = selectedObjects.filter(hasRectangle), connectors = selectedObjects.filter(hasEnds);
  const connectorOnly = selectedObjects.length > 0 && connectors.length === selectedObjects.length;
  const strokes = selectedObjects.filter(hasPoints);
  const strokeSelection = { objects: strokes, only: strokes.length > 0 && strokes.length === selectedObjects.length, sameKind: strokes.length > 0 && strokes.every((o) => o.kind === strokes[0].kind) };
  const textIdeas = ideas.filter(hasText);
  const richText = ideas.length > 0 && ideas.every((o) => objectType(o.type).richText);
  const selectionKey = JSON.stringify(selectedObjects.map((o) => o.id));
  const selectedId = selectedObjects.length === 1 ? selectedObjects[0].id : "";
  const item = board.objects.find((o) => o.id === selectedId),
    text = item && hasText(item) ? (drafts[item.id] ?? item.text) : "";
  const shapes = textIdeas.filter(usesShapePaint), otherObjects = textIdeas.filter((o) => !usesShapePaint(o));
  const shapeSelection = { objects: shapes, hasOther: otherObjects.length > 0,
    kind: commonShapeValue(shapes, (o) => o.shape!),
    fillMode: commonShapeValue(shapes, (o) => o.fill!.mode), fillColor: commonShapeValue(shapes, (o) => o.fill!.color),
    borderStyle: commonShapeValue(shapes, (o) => o.border!.style), borderColor: commonShapeValue(shapes, (o) => o.border!.color) };
  const selectionColor = commonStyle(otherObjects, "color"), selectionSize = commonStyle(textIdeas, "textSize"), selectionAlign = commonStyle(textIdeas, "align");
  const targets = textIdeas.filter((o) => o.text.length > 0);
  const selectionFormats = Object.fromEntries(FLAGS.map((flag) => [flag,
    item && hasText(item) && textSelection?.id === item.id && textSelection.end > textSelection.start
      ? formattedRange(item.marks, count(item.text), textSelection.start, textSelection.end, flag)
      : targets.length > 0 && targets.every((o) => formatted(o.marks, count(o.text), flag)),
  ])) as Record<Flag, boolean>;
  const colourLabel = selectionColor ? colorEntry(selectionColor).label : "Mixed";
  return {
    strokeSelection, ideas, connectors, connectorOnly, shapeSelection, richText, selected, setSelected, selectionKey, selectedId, item, text,
    selectionColor, selectionSize, selectionAlign, colourLabel, selectionFormats,
  };
}
