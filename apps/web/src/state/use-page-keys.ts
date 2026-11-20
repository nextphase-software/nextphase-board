// SPDX-License-Identifier: Apache-2.0
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { BoardV14 as Board } from "nextphase-board-rules/document.ts";
import type { ClipboardCommand } from "../clipboard";
import type { Flag } from "nextphase-board-rules/marks.ts";

import { nativePasteKey } from "../images.ts";
import { hiddenIds, type MapCommand } from "../mind-map";

import type { BoardVoting } from "../team/voting";
type Input = {
  page?: string;
  voting?: BoardVoting;
  chooseImages: () => void;
  exportTable: () => boolean;
  command: (name: "Undo" | "Redo" | "Duplicate" | "Delete" | "Cut" | MapCommand) => string | undefined;
  clipboardCommand: (name: ClipboardCommand) => void;
  toggleFormat: (flag: Flag) => void;
  model: RefObject<Board>;
  cancel: () => void;
  scene: RefObject<HTMLDivElement | null>;
  busy: boolean;
  composing: boolean;
  select: (value: string | Iterable<string>) => void;
  setInline: Dispatch<SetStateAction<boolean>>;
  panel: string;
  setPanel: Dispatch<SetStateAction<string>>;
  templatesButton: RefObject<HTMLButtonElement | null>;
  objectsButton: RefObject<HTMLButtonElement | null>;
  boardButton: RefObject<HTMLButtonElement | null>;
  infoButton: RefObject<HTMLButtonElement | null>;
  navButton: RefObject<HTMLButtonElement | null>;
};

export function usePageKeys({
  page, voting, chooseImages, exportTable, command, clipboardCommand, toggleFormat, model, cancel, scene, busy, composing, select,
  setInline, panel, setPanel, templatesButton, objectsButton, boardButton, infoButton, navButton,
}: Input) {
  function pageKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if(voting?.mode&&e.target===scene.current){if(e.key==='Delete'||e.key==='Backspace')e.preventDefault();return;}
    const nativeText = e.target instanceof Element &&
      !!e.target.closest("input,textarea,[contenteditable]:not([contenteditable=false])");
    // Cmd/Ctrl+Enter adds a child and Cmd/Ctrl+Shift+Enter a sibling, from the
    // canvas or the node editor.
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.altKey && !composing && !e.nativeEvent.isComposing &&
      (e.target === scene.current || e.target instanceof HTMLTextAreaElement && e.target.id === "content")) {
      e.preventDefault();
      command(e.shiftKey ? "Add sibling" : "Add child");
      return;
    }
    if (!nativeText && (e.ctrlKey || e.metaKey) && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === "e" && e.shiftKey && e.target === scene.current && !composing && !e.nativeEvent.isComposing) {
        const mac = navigator.platform.startsWith("Mac");
        if ((mac ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey) && exportTable()) e.preventDefault();
        return;
      }
      if (key === "k" && e.shiftKey && !composing && !e.nativeEvent.isComposing) { e.preventDefault(); chooseImages(); return; }
      if (key === "z" || (key === "y" && e.ctrlKey && !e.metaKey && !e.shiftKey)) {
        e.preventDefault();
        command(key === "y" || e.shiftKey ? "Redo" : "Undo");
        return;
      }
      if (key === "a" && !e.shiftKey && e.target === scene.current) {
        if (!busy && !composing && model.current.objects.length) {
          e.preventDefault();
          const hidden = hiddenIds(model.current.objects);
          select(model.current.objects.filter((o) => o.page === (page ?? model.current.boardId) && !hidden.has(o.id)).map((o) => o.id));
        }
        return;
      }
      if (key === "d" && !e.shiftKey && e.target === scene.current) {
        e.preventDefault();
        command("Duplicate");
        return;
      }
      if (e.target === scene.current && !composing && !e.nativeEvent.isComposing) {
        const flag = key === "b" && !e.shiftKey ? "bold"
          : key === "i" && !e.shiftKey ? "italic" : key === "x" && e.shiftKey ? "strike" : null;
        if (flag) { e.preventDefault(); toggleFormat(flag); return; }
      }
      if ((key === "c" || key === "x" || key === "v") && !e.shiftKey && e.target === scene.current) {
        if (key === "v" && nativePasteKey(e.nativeEvent, navigator.platform)) return;
        e.preventDefault();
        clipboardCommand(key === "c" ? "Copy" : key === "x" ? "Cut" : "Paste");
        return;
      }
    }
    if (e.target === scene.current && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey &&
      (e.key === "Delete" || e.key === "Backspace")) {
      e.preventDefault();
      command("Delete");
      return;
    }
    if (
      e.key !== "Escape" || composing ||
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement
    ) return;
    cancel();
    setInline(false);
    if (panel) {
      setPanel("");
      if (panel === "Templates") {
        (templatesButton.current && !templatesButton.current.disabled ? templatesButton.current : scene.current)?.focus();
        return;
      }
      (panel === "Objects"
        ? objectsButton
        : panel === "Board"
        ? boardButton
        : panel === "Information"
        ? infoButton
        : navButton).current?.focus();
    }
  }
  return { pageKeyDown };
}
