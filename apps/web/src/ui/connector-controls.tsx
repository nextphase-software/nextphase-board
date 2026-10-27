// SPDX-License-Identifier: Apache-2.0
import { Icon } from "../icons";

export function ConnectorControls({ count, empty, reason, edit, remove }: {
  count: number; empty: boolean; reason: string; edit: () => void; remove: () => void;
}) {
  return <>
    <span>{count === 1 ? "Connector" : count + " connectors"}</span>
    {count === 1 && empty && <button disabled={!!reason} title={reason || "Add text"}
      aria-describedby="selection-reason" onClick={edit}>Add text</button>}
    <button className="icon-button" aria-label="Delete" disabled={!!reason} title={reason || "Delete"}
      aria-describedby="selection-reason" onClick={remove}><Icon name="Delete" /><span className="tooltip">{reason || "Delete"}</span></button>
  </>;
}
