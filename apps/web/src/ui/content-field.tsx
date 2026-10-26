// SPDX-License-Identifier: Apache-2.0
import type { Dispatch, RefObject, SetStateAction } from "react";
import { count, type ItemV4 as Item, validText } from "../document";

type Props = {
  editor: RefObject<HTMLTextAreaElement | null>;
  inline: boolean;
  text: string;
  readOnly: boolean;
  busy: boolean;
  item: Item | undefined;
  selectedId: string;
  composing: boolean;
  beginTextSession: (item: Item | undefined) => void;
  changeText: (value: string) => void;
  setComposing: Dispatch<SetStateAction<boolean>>;
  setDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  commitText: (id: string, value: string) => void;
  finishTextSession: () => void;
  setInline: Dispatch<SetStateAction<boolean>>;
};

export function ContentField({
  editor, inline, text, readOnly, busy, item, selectedId, composing, beginTextSession,
  changeText, setComposing, setDrafts, commitText, finishTextSession, setInline,
}: Props) {
  return (
    <>
      <label htmlFor="content">Content</label>
      <textarea
        id="content"
        ref={editor}
        aria-label={inline ? "Edit selected object on canvas" : "Content"}
        value={text}
        readOnly={readOnly || busy}
        disabled={!item}
        onFocus={() => beginTextSession(item)}
        onChange={(e) => changeText(e.target.value)}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={(e) => {
          setComposing(false);
          const value = e.currentTarget.value;
          setDrafts((d) => ({ ...d, [selectedId]: value }));
          if (item && validText(value, 1000) && !readOnly) {
            commitText(selectedId, value);
          }
        }}
        onBlur={() => {
          if (!composing) {
            finishTextSession();
            setInline(false);
          }
        }}
      />
      <small>{count(text)} / 1,000 code points</small>
    </>
  );
}
