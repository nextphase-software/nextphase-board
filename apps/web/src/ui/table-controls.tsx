// SPDX-License-Identifier: Apache-2.0
import type { ReactNode } from "react";
import { TEXT_SIZES, type Style } from "nextphase-board-rules/styles.ts";
import { count, type TableItem } from "nextphase-board-rules/document.ts";
import { cellText, mergeOf } from "nextphase-board-rules/objects/registry.ts";
import { anchorCell, tableMode, tableReason, type TableAction, type TableSelection } from "../table";
import { Icon } from "../icons";
import { ARRANGE_WORDS as words, arrangeRefusal, mergeShown } from "../table-arrange";
import { chosenIds, countText } from "../table-selection";
import { AxisMenu } from "./table-menu";

type IconName = Parameters<typeof Icon>[0]["name"];
function TableButton({ name, icon, reason, tip = name, action }: { name: string; icon: IconName; reason?: string; tip?: string; action: () => void }) {
  return <button className="icon-button" aria-label={name} title={reason || tip} disabled={!!reason} onClick={action}>
    <Icon name={icon} /><span className="tooltip">{reason || tip}</span>
  </button>;
}

const divider = <span className="divider" aria-hidden="true" />;
export function TableControls({ table, selection, cells = 0, edit, done, draft, invalid, readOnly, composing, reason, action, size, exportTable, children, copyLink }: {
  table: TableItem; selection: TableSelection; cells: number; edit: () => void; done: () => void; draft?: string; invalid: boolean;
  readOnly: boolean; composing: boolean; reason: string; action: (a: TableAction) => void;
  size: (value: Style["textSize"]) => void; exportTable?: (() => boolean) & { disabled?: boolean; reason?: string }; children?: ReactNode; copyLink?: ReactNode;
}) {
  const editing = draft !== undefined, mode = tableMode(selection, editing);
  const length = count(draft ?? cellText(table, anchorCell(table, selection)));
  const counter = <small className={invalid ? "table-count-invalid" : undefined}>{length.toLocaleString("en-US")} / 1,000</small>;
  if (mode === "Table") return <>
    <span>Table</span>
    {!readOnly && <>{divider}
      <select className="context-size" aria-label="Text size" title={reason || "Text size"} disabled={!!reason}
        value={table.textSize} onChange={e => size(e.currentTarget.value as Style["textSize"])}>
        {TEXT_SIZES.map(s => <option key={s.name} value={s.name}>{s.label}</option>)}
      </select>
      <TableButton name="Add row" icon="Add row" reason={reason || tableReason(table, "row", "add")} action={() => action({ axis: "row", at: "end" })} />
      <TableButton name="Add column" icon="Add column" reason={reason || tableReason(table, "column", "add")} action={() => action({ axis: "column", at: "end" })} />
      {exportTable && <button className="icon-button" aria-label="Export as CSV" disabled={exportTable.disabled} onClick={exportTable}>
        <Icon name="Export as CSV" /><span className="tooltip">{exportTable.reason || "Export as CSV"}</span>
      </button>}
      {divider}{children}
    </>}
    {readOnly && copyLink}
  </>;
  if (editing) return <>
    <span>Cell</span>{divider}
    <button onMouseDown={e => e.preventDefault()} disabled={composing} onClick={done}><Icon name="Done" />Done</button>
    {divider}{counter}{copyLink}
  </>;
  if (readOnly) return <><span>Cell</span>{divider}{counter}{copyLink}</>;
  const merge = mergeShown(table, selection) && <TableButton name={words.merge} icon={words.merge} tip={words.mergeTip}
    reason={reason || arrangeRefusal(table, selection, { at: "merge" }, cells)?.reason} action={() => action({ at: "merge" })} />;
  const clear = <TableButton name="Delete content" icon="Delete content" reason={reason} action={() => action({ at: "clear" })} />;
  if (mode === "Cells") return <><span>{mode}</span>{divider}<small>{countText(table, selection)}</small>{merge}{clear}{copyLink}</>;
  if (mode === "Cell") return <>
    <span>Cell</span>{divider}
    <button disabled={!!reason} onClick={edit}><Icon name="pencil" />Edit text</button>{divider}{counter}
    <AxisMenu axis="row" table={table} selection={selection} cells={cells} action={action} />
    <AxisMenu axis="column" table={table} selection={selection} cells={cells} action={action} />
    {mergeOf(table, anchorCell(table, selection)) && <button className="icon-button table-split" aria-label={words.split}
      aria-pressed={true} title={words.splitTip} disabled={!!reason} onClick={() => action({ at: "split" })}>
      <Icon name={words.split} /><span className="tooltip">{words.splitTip}</span>
    </button>}
    {clear}
    {copyLink}
  </>;
  const axis = mode === "Row" || mode === "Rows" ? "row" : "column";
  const several = chosenIds(table, selection, axis).length > 1, remove = { axis, at: "delete" } as const;
  return <><span>{mode}</span>{divider}
    {several && <small>{countText(table, selection)}</small>}
    <AxisMenu axis={axis} table={table} selection={selection} cells={cells} action={action} />
    {merge}
    <TableButton name={words.remove(axis, several)} icon="Delete axis"
      reason={reason || arrangeRefusal(table, selection, remove, cells)?.reason} action={() => action(remove)} />
    {copyLink}
  </>;
}
