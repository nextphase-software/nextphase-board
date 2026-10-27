// SPDX-License-Identifier: Apache-2.0
import type { RefObject } from "react";
import { InformationButton } from "./information-button";
import { InformationPanel } from "./information-panel";

type Props = {
  infoButton: RefObject<HTMLButtonElement | null>; panel: string;
  busy: boolean; composing: boolean; toggle: (name: string) => void;
};
export function InformationControls({ infoButton, panel, busy, composing, toggle }: Props) {
  return <>
    <InformationButton
      infoButton={infoButton} panel={panel} busy={busy} composing={composing} toggle={toggle}
    />
    {panel === "Information" && (
      <InformationPanel
        busy={busy} composing={composing} toggle={toggle}
      />
    )}
  </>;
}
