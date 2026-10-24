// SPDX-License-Identifier: Apache-2.0
import type { RefObject } from "react";
import { Icon } from "../icons";

type Props = {
  infoButton: RefObject<HTMLButtonElement | null>;
  panel: string;
  busy: boolean;
  composing: boolean;
  toggle: (name: string) => void;
};

export function InformationButton({
  infoButton, panel, busy, composing, toggle
}: Props) {
  return (
    <button
      className="information floating icon-button"
      ref={infoButton}
      aria-label="About local storage"
      aria-expanded={panel === "Information"}
      disabled={busy || composing}
      onClick={() => toggle("Information")}
    >
      <Icon name="information" /><span className="tooltip">About local storage</span>
    </button>
  );
}
