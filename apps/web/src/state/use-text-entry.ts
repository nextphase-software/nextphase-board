// SPDX-License-Identifier: Apache-2.0
import { useRef, useState } from "react";
import type { TextSelection } from "nextphase-board-rules/marks.ts";

import type { TableEntry, TableDraft } from "../table";

export function useTextEntry() {
  const [inline, setNativeInline] = useState(false),
    [composing, setComposing] = useState(false),
    [textSelection, setTextSelection] = useState<TextSelection | null>(null);
  const [tableDraft, setTableDraft] = useState<TableDraft | null>(null);
  const composition = useRef<{ base: string; offset: number; changed: boolean } | null>(null);
  function setInline(value: React.SetStateAction<boolean>) {
    if (value === false) { setTableDraft(null); composition.current = null; }
    setNativeInline(value);
  }
  const tableEntry: TableEntry = { endComposition: () => setComposing(false), draft: tableDraft, setDraft: setTableDraft, composition,
    exitBefore: <T,>(action: () => T, finish: () => void) => () => {
      if (tableDraft && !composing) { finish(); setInline(false); }
      return action();
    } };
  return { tableEntry, inline, setInline, composing, setComposing, textSelection, setTextSelection };
}
