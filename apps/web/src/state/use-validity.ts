// SPDX-License-Identifier: Apache-2.0
import { useRef } from "react";
import { type BoardV3 as Board, validText } from "../document";

type Input = {
  board: Board;
  drafts: Record<string, string>;
  title: string;
  composing: boolean;
  busy: boolean;
};

export function useValidity({ board, drafts, title, composing, busy }: Input) {
  const invalidObjectFields = board.objects.flatMap((o, i) =>
    !validText(drafts[o.id] ?? o.text, 1000)
      ? [
        "Object " + (i + 1) +
        " exceeds 1,000 code points or contains invalid Unicode. Correct it in Objects.",
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
  return { invalidObjectText, invalidFields, invalid, pending };
}
