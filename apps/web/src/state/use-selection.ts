// SPDX-License-Identifier: Apache-2.0
import { useState } from "react";
import type { BoardV12 as Board, TableItem } from "nextphase-board-rules/document.ts";
import { count } from "nextphase-board-rules/document.ts";
import { FLAGS, formatted, formattedRange, type Flag, type TextSelection } from "nextphase-board-rules/marks.ts";
import { isTape, isTable, objectType, isMedia, hasText, hasPoints, usesShapePaint, commonShapeValue, hasRectangle, hasEnds } from "nextphase-board-rules/objects/registry.ts";
import { colorEntry, commonStyle } from "nextphase-board-rules/styles.ts";

import { numberedObjectLabel } from "../sections";
import { announceCell, validTableSelection, type TableSelection } from "../table";

type Input = {
  board: Board;
  drafts: Record<string, string>;
  textSelection: TextSelection | null;
};

export function useSelection({ board, drafts, textSelection }: Input) {
  const [level, setLevel] = useState<{ selection: TableSelection; announcement: string } | null>(null);
  const [selected, setIds] = useState<Set<string>>(() => new Set());
  const selectedObjects = board.objects.filter((o) => selected.has(o.id));
  const ideas = selectedObjects.filter(hasRectangle), connectors = selectedObjects.filter(hasEnds);
  const connectorOnly = selectedObjects.length > 0 && connectors.length === selectedObjects.length;
  const strokes = selectedObjects.filter(hasPoints);
  const strokeSelection = { objects: strokes, only: strokes.length > 0 && strokes.length === selectedObjects.length, sameKind: strokes.length > 0 && strokes.every((o) => o.kind === strokes[0].kind) };
  const tapes = selectedObjects.filter(isTape);
  const tapeSelection = { objects: tapes, only: tapes.length > 0 && tapes.length === selectedObjects.length };
  const textIdeas = ideas.filter(hasText);
  const formattingIdeas = ideas.filter((o) => !isMedia(o));
  const richText = formattingIdeas.length > 0 && formattingIdeas.every((o) => objectType(o.type).richText);
  const selectionKey = JSON.stringify(selectedObjects.map((o) => o.id));
  const selectedId = selectedObjects.length === 1 ? selectedObjects[0].id : "";
  const item = board.objects.find((o) => o.id === selectedId),
    text = item && hasText(item) ? (drafts[item.id] ?? item.text) : "";
  const table = item && isTable(item) ? item : undefined;
  const tableSelection = table ? level?.selection.id === table.id
    ? validTableSelection(table, level.selection, false, "own").selection ?? undefined : { kind: "table" as const, id: table.id } : undefined;
  const tableAnnouncement = tableSelection?.kind === "cell" ? level?.announcement ?? "" : "";
  function setSelected(ids: Set<string>) { setLevel(null); setIds(ids); }
  function chooseTable(next: TableSelection, table: TableItem) {
    setIds(new Set([next.id]));
    setLevel({ selection: next, announcement: next.kind === "cell" ? announceCell(table, next) : "" });
  }
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
    tableName: table ? numberedObjectLabel(board, table) : "", tableSelection, tableAnnouncement, chooseTable, tapeSelection, strokeSelection, ideas, connectors, connectorOnly, shapeSelection, richText, selected, setSelected, selectionKey, selectedId, item, text,
    selectionColor, selectionSize, selectionAlign, colourLabel, selectionFormats,
  };
}
