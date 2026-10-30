// SPDX-License-Identifier: Apache-2.0
import { useState } from "react";
import type { TextSelection } from "nextphase-board-rules/marks.ts";

export function useTextEntry() {
  const [inline, setInline] = useState(false),
    [composing, setComposing] = useState(false),
    [textSelection, setTextSelection] = useState<TextSelection | null>(null);
  return { inline, setInline, composing, setComposing, textSelection, setTextSelection };
}
