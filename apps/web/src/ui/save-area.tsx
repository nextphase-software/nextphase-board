// SPDX-License-Identifier: Apache-2.0
import type { RefObject } from "react";
import { Icon } from "../icons";

import type { TeamParts } from "../team/team-app";

type Props = {
  team?: TeamParts;
  latestAcknowledgement: RefObject<string>;
  status: string;
  invalid: boolean;
  save: () => void;
  readOnly: boolean;
  composing: boolean;
  busy: boolean;
};

export function SaveArea({
  latestAcknowledgement, status, invalid, save, readOnly, composing, busy, team
}: Props) {
  return (
    <section className="actions floating" aria-describedby={latestAcknowledgement.current ? "save-acknowledgement" : undefined}>
      {team?.people && <>{team.people}<span className="divider" aria-hidden="true" /></>}
      <span className={"save-status" + (team?.hosted?.status.startsWith("Offline —") ? " team-amber" : "")} role="status">
        <Icon name="status" />{team?.hosted?.status ?? status}{invalid && !team?.hosted ? " · Invalid draft" : ""}
      </span>
      <span id="save-acknowledgement" className="sr-only">{latestAcknowledgement.current}</span>
      {!team?.hosted && <button
        className={status === "Save failed" ? "error" : status === "Unsaved" ? "primary" : ""}
        onClick={save}
        disabled={readOnly || invalid || composing || busy}
      >
        {status === "Save failed" ? "Retry save" : "Save"}
      </button>}
      {team?.saveControl}
    </section>
  );
}
