// SPDX-License-Identifier: Apache-2.0
import type { Dispatch, RefObject, SetStateAction, SyntheticEvent } from "react";
import { count, type ItemV5 as Item, validText } from "../document";
import { objectType } from "../objects/registry";
import { codePointOffset, type Flag, type TextSelection } from "../marks";

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
  setTextSelection: Dispatch<SetStateAction<TextSelection | null>>;
  toggleFormat: (flag: Flag) => void;
};

export function ContentField({
  editor, inline, text, readOnly, busy, item, selectedId, composing, beginTextSession,
  changeText, setComposing, setDrafts, commitText, finishTextSession, setInline,
  setTextSelection, toggleFormat,
}: Props) {
  const type = item ? objectType(item.type) : undefined;
  const label = type && !type.richText ? "Name" : "Content";
  const limit = type?.textLimit ?? 1000;
  function track(e: SyntheticEvent<HTMLTextAreaElement>) {
    const field = e.currentTarget;
    setTextSelection(item ? { id: item.id,
      start: codePointOffset(field.value, field.selectionStart),
      end: codePointOffset(field.value, field.selectionEnd),
    } : null);
  }
  return (
    <>
      <label htmlFor="content">{label}</label>
      <textarea
        id="content"
        ref={editor}
        aria-label={inline ? label === "Name" ? "Edit selected name on canvas" : "Edit selected object on canvas" : label}
        value={text}
        readOnly={readOnly || busy}
        disabled={!item}
        onFocus={(e) => { beginTextSession(item); track(e); }}
        onSelect={track}
        onKeyDown={(e) => {
          if (!type?.richText || composing || e.nativeEvent.isComposing || !(e.ctrlKey || e.metaKey) || e.altKey) return;
          const key = e.key.toLowerCase();
          const flag = key === "b" && !e.shiftKey ? "bold"
            : key === "i" && !e.shiftKey ? "italic" : key === "x" && e.shiftKey ? "strike" : null;
          if (flag) { e.preventDefault(); toggleFormat(flag); }
        }}
        onChange={(e) => changeText(e.target.value)}
        onCompositionStart={() => setComposing(true)}
        onCompositionEnd={(e) => {
          setComposing(false);
          const value = e.currentTarget.value;
          setDrafts((d) => ({ ...d, [selectedId]: value }));
          if (item && validText(value, limit) && !readOnly) {
            commitText(selectedId, value);
          }
        }}
        onBlur={() => {
          setTextSelection(null);
          if (!composing) {
            finishTextSession();
            setInline(false);
          }
        }}
      />
      <small>{count(text)} / {limit.toLocaleString("en-US")} code points</small>
    </>
  );
}
