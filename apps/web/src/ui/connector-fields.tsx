// SPDX-License-Identifier: Apache-2.0
import type { KeyboardEvent } from "react";
import type { BoardV9, ConnectorItem } from "../document";
import { END_SIDES, eligibleIdea } from "../objects/registry";
import { objectLabel } from "../sections";
import type { ConnectorCommands } from "./connector-menu";
function selectKey(e: KeyboardEvent<HTMLSelectElement>, choose: (value: string) => void) {
  const select = e.currentTarget, options = Array.from(select.options);
  let index = select.selectedIndex;
  if (e.key === "Home") index = 0;
  else if (e.key === "End") index = options.length - 1;
  else if (e.key === "ArrowUp") index = Math.max(0, index - 1);
  else if (e.key === "ArrowDown") index = Math.min(options.length - 1, index + 1);
  else return;
  e.preventDefault(); e.stopPropagation();
  if (options[index]) choose(options[index].value);
}
export function ConnectorFields({ board, object, numbers, drafts, commands, reason }: {
  board: BoardV9; object: ConnectorItem; numbers: Map<string, number>; drafts: Record<string, string>; commands: ConnectorCommands; reason: string;
}) {
  return <fieldset className="connector-ends" disabled={!!reason} aria-describedby="selection-reason"><legend>Ends</legend>
    {(["from", "to"] as const).map((end) => {
      const title = end === "from" ? "From" : "To", other = object[end === "from" ? "to" : "from"].object;
      const chooseIdea = (value: string) => commands.reconnect(object.id, end, { ...object[end], object: value });
      const chooseSide = (value: string) => commands.reconnect(object.id, end, { ...object[end], anchor: value as typeof END_SIDES[number] });
      return <div className="connector-end" key={end}>
        <label htmlFor={"connector-" + end}>{title}</label>
        <select id={"connector-" + end} value={object[end].object} title={reason || title}
          onChange={(e) => chooseIdea(e.target.value)} onKeyDown={(e) => selectKey(e, chooseIdea)}>
          {board.objects.filter(eligibleIdea).filter((o) => o.id !== other).map((o) => <option key={o.id} value={o.id}>{objectLabel(board, o, numbers, drafts)}</option>)}
        </select>
        <label htmlFor={"connector-" + end + "-side"}>{title} side</label>
        <select id={"connector-" + end + "-side"} value={object[end].anchor} title={reason || title + " side"}
          onChange={(e) => chooseSide(e.target.value)} onKeyDown={(e) => selectKey(e, chooseSide)}>
          {END_SIDES.map((side, i) => <option key={side} value={side}>{["Nearest side", "Top", "Right", "Bottom", "Left"][i]}</option>)}
        </select>
      </div>;
    })}
  </fieldset>;
}
