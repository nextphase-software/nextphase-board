// SPDX-License-Identifier: Apache-2.0
import { useState } from "react";
import type { BoardV5 as Board } from "../document";
import { count } from "../document";
import { FLAGS, formatted, formattedRange, type Flag, type TextSelection } from "../marks";
import { objectType } from "../objects/registry";
import { colorEntry, commonStyle } from "../styles";

type Input = {
  board: Board;
  drafts: Record<string, string>;
  textSelection: TextSelection | null;
};

export function useSelection({ board, drafts, textSelection }: Input) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const selectedObjects = board.objects.filter((o) => selected.has(o.id));
  const richText = selectedObjects.every((o) => objectType(o.type).richText);
  const selectionKey = JSON.stringify(selectedObjects.map((o) => o.id));
  const selectedId = selectedObjects.length === 1 ? selectedObjects[0].id : "";
  const item = board.objects.find((o) => o.id === selectedId),
    text = item ? (drafts[item.id] ?? item.text) : "";
  const selectionColor = commonStyle(selectedObjects, "color"), selectionSize = commonStyle(selectedObjects, "textSize"), selectionAlign = commonStyle(selectedObjects, "align");
  const targets = selectedObjects.filter((o) => o.text.length > 0);
  const selectionFormats = Object.fromEntries(FLAGS.map((flag) => [flag,
    item && textSelection?.id === item.id && textSelection.end > textSelection.start
      ? formattedRange(item.marks, count(item.text), textSelection.start, textSelection.end, flag)
      : targets.length > 0 && targets.every((o) => formatted(o.marks, count(o.text), flag)),
  ])) as Record<Flag, boolean>;
  const colourLabel = selectionColor ? colorEntry(selectionColor).label : "Mixed";
  return {
    richText, selected, setSelected, selectionKey, selectedId, item, text,
    selectionColor, selectionSize, selectionAlign, colourLabel, selectionFormats,
  };
}
