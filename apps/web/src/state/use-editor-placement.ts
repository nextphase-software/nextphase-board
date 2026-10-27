// SPDX-License-Identifier: Apache-2.0
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { ResolvedItem as Item } from "../document";
import { objectType, rectangleType, textBox, hasEnds } from "../objects/registry";
import { labelEditorBox } from "../connectors";
import { textUnits } from "../styles";
import type { View } from "../view";

type Input = {
  finishTextSession: () => void;
  setTool: Dispatch<SetStateAction<string>>;
  scene: React.RefObject<HTMLDivElement | null>;
  view: View;
  size: { w: number; h: number };
  selected: Set<string>;
  item: Item | undefined;
  itemHeight: number;
  text: string;
  inline: boolean;
  setInline: Dispatch<SetStateAction<boolean>>;
  composing: boolean;
  busy: boolean;
  readOnly: boolean;
  pos: (o: { x: number; y: number }) => { left: number; top: number };
};

export function useEditorPlacement({
  finishTextSession, setTool, scene, view, size, selected, item, itemHeight, inline, setInline,
  composing, busy, readOnly, pos, text,
}: Input) {
  const [panel, setPanel] = useState("");
  const fallbackFocus = useRef(false);
  const editor = useRef<HTMLTextAreaElement>(null),
    selector = useRef<HTMLSelectElement>(null),
    objectsButton = useRef<HTMLButtonElement>(null),
    templatesButton = useRef<HTMLButtonElement>(null),
    firstTemplateButton = useRef<HTMLButtonElement>(null),
    boardButton = useRef<HTMLButtonElement>(null),
    navButton = useRef<HTMLButtonElement>(null),
    infoButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (inline && !composing) {
      editor.current?.focus();
      if (item && !objectType(item.type).richText && item.text === objectType(item.type).initialText) editor.current?.select();
    }
  }, [inline, selected]);
  useEffect(() => {
    if (panel === "Templates") firstTemplateButton.current?.focus();
    if (panel === "Objects") {
      if (fallbackFocus.current) {
        fallbackFocus.current = false;
        editor.current?.focus();
        if (item && !objectType(item.type).richText && item.text === objectType(item.type).initialText) editor.current?.select();
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
    const p = pos(item), rect = (objectType(item.type).richText ? editor.current : editor.current?.parentElement)?.getBoundingClientRect();
    const obscured = rect &&
      Array.from(
        document.querySelectorAll(".file,.actions,.palette,.zoom,.notice"),
      ).some((el) => {
        const r = el.getBoundingClientRect();
        return rect.left < r.right && rect.right > r.left &&
          rect.top < r.bottom && rect.bottom > r.top;
      });
    const richText = objectType(item.type).richText;
    if (hasEnds(item)) {
      const box = labelEditorBox(item.connectorLayout!.labelPoint, text), p = pos(box);
      if (size.w < 768 || p.left < 0 || p.top < 0 || p.left + box.width * view.z > size.w ||
        p.top + box.height * view.z > size.h || 18 * view.z < 12 || obscured) fallbackEditor();
      return;
    }
    if (!richText) {
      const left = p.left + 2 * view.z, top = p.top - 34 * view.z;
      if (left < 0 || top < 0 || left + Math.min(item.width, 200) * view.z > size.w ||
        top + 28 * view.z > size.h || 28 * view.z < 16 || obscured) fallbackEditor();
      return;
    }
    if (
      size.w < 768 || p.left < 0 || p.top < 0 ||
      p.left + item.width * view.z > size.w ||
      p.top + itemHeight * view.z > size.h ||
      textBox({ ...item, height: itemHeight }).width * view.z < rectangleType(item.type as Parameters<typeof rectangleType>[0]).editorMinimum.width ||
      textBox({ ...item, height: itemHeight }).height * view.z < rectangleType(item.type as Parameters<typeof rectangleType>[0]).editorMinimum.height ||
      textUnits(item.textSize) * view.z < 12 || obscured
    ) fallbackEditor();
  }, [inline, selected, view, size, composing, itemHeight, item?.width, item?.textSize, item?.connectorLayout?.labelPoint.x, item?.connectorLayout?.labelPoint.y, item?.connectorLayout ? text : undefined]);
  function toggle(name: string) {
    if (composing || busy) return;
    finishTextSession();
    setInline(false);
    if (name === "Templates" && panel !== name) setTool("Select");
    setPanel((p) => p === name ? "" : name);
    if (panel === name) {
      if (name === "Templates") {
        (templatesButton.current && !templatesButton.current.disabled ? templatesButton.current : scene.current)?.focus();
        return;
      }
      (name === "Objects"
        ? objectsButton
        : name === "Board"
        ? boardButton
        : name === "Information"
        ? infoButton
        : navButton).current?.focus();
    }
  }
  return { templatesButton, firstTemplateButton, panel, setPanel, edit, toggle, editor, selector, objectsButton, boardButton, navButton, infoButton };
}
