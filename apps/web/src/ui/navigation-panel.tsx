// SPDX-License-Identifier: Apache-2.0
import type { Dispatch, SetStateAction, RefObject } from "react";
import { clamp } from "../document";
import type { View } from "../view";

type Props = {
  busy: boolean;
  composing: boolean;
  setView: Dispatch<SetStateAction<View>>;
  setPanel: Dispatch<SetStateAction<string>>;
  navButton: RefObject<HTMLButtonElement | null>;
};

export function NavigationPanel({
  busy, composing, setView, setPanel, navButton
}: Props) {
  return (
    <section className="navigation floating">
      <h2>Move around the board</h2>
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
