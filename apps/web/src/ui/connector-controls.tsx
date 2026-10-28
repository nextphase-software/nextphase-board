// SPDX-License-Identifier: Apache-2.0
import { ConnectorMenu, type ConnectorMenuProps } from "./connector-menu";
import { Icon } from "../icons";

export function ConnectorControls({ count, empty, reason, edit, remove, objects, commands, popup }: {
  count: number; empty: boolean; reason: string; edit: () => void; remove: () => void;
} & ConnectorMenuProps) {
  return <>
    <span>{count === 1 ? "Connector" : count + " connectors"}</span>
    <ConnectorMenu objects={objects} commands={commands} popup={popup} reason={reason} name="colour" />
    <ConnectorMenu objects={objects} commands={commands} popup={popup} reason={reason} name="line" />
    {count === 1 && empty && <button disabled={!!reason} title={reason || "Add text"}
      aria-describedby="selection-reason" onClick={edit}>Add text</button>}
    <span className="divider" aria-hidden="true" />
    {(["start", "route", "end"] as const).map((name) => <ConnectorMenu key={name} objects={objects} commands={commands} popup={popup} reason={reason} name={name} />)}
    <span className="divider" aria-hidden="true" />
    <button className="icon-button" aria-label="Delete" disabled={!!reason} title={reason || "Delete"}
      aria-describedby="selection-reason" onClick={remove}><Icon name="Delete" /><span className="tooltip">{reason || "Delete"}</span></button>
  </>;
}
