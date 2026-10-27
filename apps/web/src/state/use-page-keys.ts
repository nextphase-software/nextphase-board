// SPDX-License-Identifier: Apache-2.0
import type { Dispatch, RefObject, SetStateAction } from "react";
import type { BoardV6 as Board } from "../document";
import type { ClipboardCommand } from "../clipboard";
import type { Flag } from "../marks";

type Input = {
  command: (name: "Undo" | "Redo" | "Duplicate" | "Delete" | "Cut") => string | undefined;
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
  objectsButton: RefObject<HTMLButtonElement | null>;
  boardButton: RefObject<HTMLButtonElement | null>;
  infoButton: RefObject<HTMLButtonElement | null>;
  navButton: RefObject<HTMLButtonElement | null>;
};

export function usePageKeys({
  command, clipboardCommand, toggleFormat, model, cancel, scene, busy, composing, select,
  setInline, panel, setPanel, objectsButton, boardButton, infoButton, navButton,
}: Input) {
  function pageKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    const nativeText = e.target instanceof Element &&
      !!e.target.closest("input,textarea,[contenteditable]:not([contenteditable=false])");
    if (!nativeText && (e.ctrlKey || e.metaKey) && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === "z" || (key === "y" && e.ctrlKey && !e.metaKey && !e.shiftKey)) {
        e.preventDefault();
        command(key === "y" || e.shiftKey ? "Redo" : "Undo");
        return;
      }
      if (key === "a" && !e.shiftKey && e.target === scene.current) {
        if (!busy && !composing && model.current.objects.length) {
          e.preventDefault();
          select(model.current.objects.map((o) => o.id));
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
