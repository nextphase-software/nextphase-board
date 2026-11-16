// SPDX-License-Identifier: Apache-2.0
import type { Dispatch, SetStateAction, RefObject } from "react";
import { clamp } from "nextphase-board-rules/document.ts";
import type { FindActions } from "../find";
import type { View } from "../view";

type Props = {
  find: FindActions;
  busy: boolean;
  composing: boolean;
  setView: Dispatch<SetStateAction<View>>;
  setPanel: Dispatch<SetStateAction<string>>;
  navButton: RefObject<HTMLButtonElement | null>;
};

export function NavigationPanel({
  busy, composing, setView, setPanel, navButton, find
}: Props) {
  return (
    <section className="navigation floating">
      <h2>Move around the board</h2>
      <button disabled={busy || composing} onClick={find.show}>Find on board<kbd className="find-hint">{find.shortcut}</kbd></button>
      <div className="navigation-fit">
        <button disabled={busy || composing || !find.canFit} title={!find.canFit ? "Add something to the board first" : undefined}
          onClick={find.zoomToFit}>Zoom to fit<kbd>⇧1</kbd></button>
        <button disabled={busy || composing || !find.canFitSelection} title={!find.canFitSelection ? "Select something to zoom to" : undefined}
          onClick={find.zoomToSelection}>Zoom to selection<kbd>⇧2</kbd></button>
      </div>
      <h3>{find.multiplePages ? "Sections on this page" : "Sections"}</h3>
      {find.sections.length ? <ul className="navigation-sections">{find.sections.map(section => <li key={section.id}>
        <button disabled={busy || composing} aria-label={'Go to section ' + section.label} onClick={() => find.fitSection(section.id)}>{section.label}</button>
      </li>)}</ul> : <p className="navigation-empty">No sections yet</p>}
      <h3>Move</h3>
      <div className="navigation-pan">
      {[["left", -100, 0], ["right", 100, 0], ["up", 0, -100], [
        "down",
        0,
        100,
      ]].map(([s, x, y]) => (
        <button
          key={s}
          disabled={busy || composing}
          onClick={() =>
            setView((v) => ({
              ...v,
              x: clamp(v.x + Number(x), -1e6, 1e6),
              y: clamp(v.y + Number(y), -1e6, 1e6),
            }))}
        >
          Pan {s}
        </button>
      ))}
      </div>
      <button disabled={busy || composing} onClick={() => setView({ x: 0, y: 0, z: 1 })}>
        Reset view
      </button>
      <button
        disabled={busy || composing}
        onClick={() => {
          setPanel("");
          navButton.current?.focus();
        }}
      >
        Close navigation
      </button>
    </section>
  );
}
