// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { ItemV5 as Item } from "../document";
import { textUnits } from "../styles";
import type { View } from "../view";

type Input = {
  finishTextSession: () => void;
  view: View;
  size: { w: number; h: number };
  selected: Set<string>;
  item: Item | undefined;
  itemHeight: number;
  inline: boolean;
  setInline: Dispatch<SetStateAction<boolean>>;
  composing: boolean;
  busy: boolean;
  readOnly: boolean;
  pos: (o: { x: number; y: number }) => { left: number; top: number };
};

export function useEditorPlacement({
  finishTextSession, view, size, selected, item, itemHeight, inline, setInline,
  composing, busy, readOnly, pos,
}: Input) {
  const [panel, setPanel] = useState("");
  const fallbackFocus = useRef(false);
  const editor = useRef<HTMLTextAreaElement>(null),
    selector = useRef<HTMLSelectElement>(null),
    objectsButton = useRef<HTMLButtonElement>(null),
    boardButton = useRef<HTMLButtonElement>(null),
    navButton = useRef<HTMLButtonElement>(null),
    infoButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (inline && !composing) editor.current?.focus();
  }, [inline, selected]);
  useEffect(() => {
    if (panel === "Objects") {
      if (fallbackFocus.current) {
        fallbackFocus.current = false;
        editor.current?.focus();
      } else selector.current?.focus();
    }
  }, [panel]);
  function fallbackEditor() {
    finishTextSession();
    fallbackFocus.current = true;
    setPanel("Objects");
    setInline(false);
  }
  function edit() {
    if (!item || readOnly || busy || composing) return;
    finishTextSession();
    setPanel("");
    setInline(true);
  }
  useEffect(() => {
    if (!inline || !item || composing) return;
    const p = pos(item), rect = editor.current?.getBoundingClientRect();
    const obscured = rect &&
      Array.from(
        document.querySelectorAll(".file,.actions,.palette,.zoom,.notice"),
      ).some((el) => {
        const r = el.getBoundingClientRect();
        return rect.left < r.right && rect.right > r.left &&
          rect.top < r.bottom && rect.bottom > r.top;
      });
    if (
      size.w < 768 || p.left < 0 || p.top < 0 ||
      p.left + item.width * view.z > size.w ||
      p.top + itemHeight * view.z > size.h ||
      (item.width - 40) * view.z < 120 || (itemHeight - 40) * view.z < 60 ||
      textUnits(item.textSize) * view.z < 12 || obscured
    ) fallbackEditor();
  }, [inline, selected, view, size, composing, itemHeight, item?.width, item?.textSize]);
  function toggle(name: string) {
    if (composing || busy) return;
    finishTextSession();
    setInline(false);
    setPanel((p) => p === name ? "" : name);
    if (panel === name) {
      (name === "Objects"
        ? objectsButton
        : name === "Board"
        ? boardButton
        : name === "Information"
        ? infoButton
        : navButton).current?.focus();
    }
  }
  return { panel, setPanel, edit, toggle, editor, selector, objectsButton, boardButton, navButton, infoButton };
}
