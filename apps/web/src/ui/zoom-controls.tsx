// SPDX-License-Identifier: Apache-2.0
import type { Dispatch, SetStateAction, RefObject } from "react";
import { Icon } from "../icons";
import { stepZoom, type View } from "../view";

type Props = {
  busy: boolean;
  composing: boolean;
  setView: Dispatch<SetStateAction<View>>;
  view: View;
  panel: string;
  navButton: RefObject<HTMLButtonElement | null>;
  toggle: (name: string) => void;
};

export function ZoomControls({
  busy, composing, setView, view, panel, navButton, toggle
}: Props) {
  return (
    <nav className="zoom floating">
      <button
        className="icon-button"
        aria-label="Zoom out"
        disabled={busy || composing}
        onClick={() => setView((v) => ({ ...v, z: stepZoom(v.z, -1) }))}
      >
        <Icon name="minus" /><span className="tooltip">Zoom out</span>
      </button>
      <span>{Math.round(view.z * 100)}%</span>
      <button
        className="icon-button"
        aria-label="Zoom in"
        disabled={busy || composing}
        onClick={() => setView((v) => ({ ...v, z: stepZoom(v.z, 1) }))}
      >
        <Icon name="plus" /><span className="tooltip">Zoom in</span>
      </button>
      <span className="divider" aria-hidden="true" />
      <button
        className="icon-button"
        aria-label="Navigation"
        aria-expanded={panel === "Navigation"}
        ref={navButton}
        onClick={() => toggle("Navigation")}
        disabled={busy || composing}
      >
        <Icon name="navigation" /><span className="tooltip">Navigation</span>
      </button>
    </nav>
  );
}
