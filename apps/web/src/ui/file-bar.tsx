// SPDX-License-Identifier: Apache-2.0
import type { RefObject } from "react";
import { Icon } from "../icons";

type Props = {
  boardButton: RefObject<HTMLButtonElement | null>;
  composing: boolean;
  busy: boolean;
  toggle: (name: string) => void;
  panel: string;
  title: string;
  objectsButton: RefObject<HTMLButtonElement | null>;
  undoReason: string;
  redoReason: string;
  command: (name: "Undo" | "Redo" | "Duplicate" | "Delete" | "Cut") => void;
};

export function FileBar({
  boardButton, composing, busy, toggle, panel, title, objectsButton, undoReason, redoReason,
  command
}: Props) {
  return (
    <section className="file floating">
      <button
        ref={boardButton}
        disabled={composing || busy}
        onClick={() => toggle("Board")}
        aria-expanded={panel === "Board"}
      >
        <b className="brand" aria-hidden="true">N</b>
        <span className="board-title">{title || "Untitled board"}</span>
        <Icon name="chevron" />
      </button>
      <small>Local</small>
      <span className="divider" aria-hidden="true" />
      <button
        className="icon-button"
        ref={objectsButton}
        onClick={() => toggle("Objects")}
        aria-label="Objects"
        aria-expanded={panel === "Objects"}
        disabled={composing || busy}
      >
        <Icon name="objects" /><span className="tooltip">Objects</span>
      </button>
      {(["Undo", "Redo"] as const).map((name) => (
        <button
          key={name}
          className="icon-button"
          aria-label={name}
          aria-describedby={name === "Undo" ? "undo-reason" : "redo-reason"}
          aria-disabled={!!(name === "Undo" ? undoReason : redoReason)}
          onClick={() => command(name)}
        >
          <Icon name={name} /><span className="tooltip">{(name === "Undo" ? undoReason : redoReason) || name}</span>
        </button>
      ))}
    </section>
  );
}
