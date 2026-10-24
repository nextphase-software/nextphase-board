// SPDX-License-Identifier: Apache-2.0
import type { RefObject } from "react";
import { Icon } from "../icons";

type Props = {
  latestAcknowledgement: RefObject<string>;
  status: string;
  invalid: boolean;
  save: () => void;
  readOnly: boolean;
  composing: boolean;
  busy: boolean;
};

export function SaveArea({
  latestAcknowledgement, status, invalid, save, readOnly, composing, busy
}: Props) {
  return (
    <section className="actions floating" aria-describedby={latestAcknowledgement.current ? "save-acknowledgement" : undefined}>
      <span className="save-status" role="status">
        <Icon name="status" />{status}{invalid ? " · Invalid draft" : ""}
      </span>
      <span id="save-acknowledgement" className="sr-only">{latestAcknowledgement.current}</span>
      <button
        className={status === "Save failed" ? "error" : status === "Unsaved" ? "primary" : ""}
        onClick={save}
        disabled={readOnly || invalid || composing || busy}
      >
        {status === "Save failed" ? "Retry save" : "Save"}
      </button>
    </section>
  );
}
