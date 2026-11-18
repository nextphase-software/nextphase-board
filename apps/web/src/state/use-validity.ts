// SPDX-License-Identifier: Apache-2.0
import { useRef } from "react";
import { objectType, hasText, validCellText } from "nextphase-board-rules/objects/registry.ts";
import { type BoardV12 as Board, validText } from "nextphase-board-rules/document.ts";

import { TABLE_LIMIT_WORDS } from "../table";

type Input = {
  cellDraft?: string;
  board: Board;
  drafts: Record<string, string>;
  title: string;
  composing: boolean;
  busy: boolean;
};

export function useValidity({ board, drafts, title, composing, busy, cellDraft }: Input) {
  const invalidObjectFields = board.objects.flatMap((o, i) =>
    hasText(o) && !validText(drafts[o.id] ?? o.text, objectType(o.type).textLimit)
      ? [
        "Object " + (i + 1) +
        " exceeds " + objectType(o.type).textLimit.toLocaleString("en-US") + " code points or contains invalid Unicode. Correct it in Objects.",
      ]
      : []
  );
  const invalidObjectText = invalidObjectFields.length > 0;
  const invalidFields = [
    ...(!validText(title, 120, true)
      ? ["Board name requires 1–120 code points and cannot be blank."]
      : []),
    ...invalidObjectFields,
  ];
  const invalid = invalidFields.length > 0;
  const pending = useRef({ invalid: true, composing: false, busy: false });
  pending.current = { invalid, composing, busy };
  const cellInvalid = cellDraft !== undefined && !validCellText(cellDraft);
  return { cellInvalid, cellInvalidNotice: cellInvalid ? TABLE_LIMIT_WORDS : "", invalidObjectText, invalidFields, invalid, pending };
}
