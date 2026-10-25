// SPDX-License-Identifier: Apache-2.0
import { useState } from "react";
import type { BoardV3 as Board } from "../document";
import { colorEntry, type Style } from "../styles";

type Input = {
  board: Board;
  drafts: Record<string, string>;
};

export function useSelection({ board, drafts }: Input) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const selectedObjects = board.objects.filter((o) => selected.has(o.id));
  const selectionKey = JSON.stringify(selectedObjects.map((o) => o.id));
  const selectedId = selectedObjects.length === 1 ? selectedObjects[0].id : "";
  const item = board.objects.find((o) => o.id === selectedId),
    text = item ? (drafts[item.id] ?? item.text) : "";
  const commonStyle = <K extends keyof Style>(key: K): Style[K] | "" => {
    const value = selectedObjects[0]?.[key];
    return value && selectedObjects.every((o) => o[key] === value) ? value : "";
  };
  const selectionColor = commonStyle("color"), selectionSize = commonStyle("textSize"), selectionAlign = commonStyle("align");
  const colourLabel = selectionColor ? colorEntry(selectionColor).label : "Mixed";
  return {
    selected, setSelected, selectionKey, selectedId, item, text,
    selectionColor, selectionSize, selectionAlign, colourLabel,
  };
}
