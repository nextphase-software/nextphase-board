// SPDX-License-Identifier: Apache-2.0
import type { ReactNode } from "react";
import { TEXT_SIZES, type Style } from "nextphase-board-rules/styles.ts";
import { count, type TableItem } from "nextphase-board-rules/document.ts";
import { cellText, type TableAxis } from "nextphase-board-rules/objects/registry.ts";
import { anchorCell, tableMode, tableReason, type TableAction, type TableSelection } from "../table";
import { Icon } from "../icons";

type IconName = Parameters<typeof Icon>[0]["name"];
function TableButton({ name, icon, reason, action }: { name: string; icon: IconName; reason?: string; action: () => void }) {
  return <button className="icon-button" aria-label={name} title={reason || name} disabled={!!reason} onClick={action}>
    <Icon name={icon} /><span className="tooltip">{reason || name}</span>
  </button>;
}

function AxisMenu({ axis, table, action }: { axis: TableAxis; table: TableItem; action: (a: TableAction) => void }) {

  const row = axis === "row", heading = row ? "Row" : "Column", name = heading + " options";
  const entries = [
    { at: "before", name: row ? "Add row above" : "Add column to the left", key: row ? "⌥⇧↩" : "⌥[" },
    { at: "after", name: row ? "Add row below" : "Add column to the right", key: row ? "⌥↩" : "⌥]" },
    { at: "delete", name: "Delete " + axis, key: "⌫" },
  ] as const;
  function toggle(container: HTMLElement, open: boolean, restoreFocus = false) {
    const button = container.querySelector<HTMLButtonElement>(".table-menu-button")!;
    const menu = container.querySelector<HTMLElement>(".table-menu")!;
    menu.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    if (open) (menu.querySelector<HTMLButtonElement>("button:not(:disabled)") ?? menu).focus();
    else if (restoreFocus) button.focus();
  }
  return <span className="table-menu-control" ref={node => {
    if (!node) return;
    const outside = (e: Event) => {
      if (e.target instanceof Node && !node.contains(e.target) &&
          node.querySelector('.table-menu-button[aria-expanded="true"]')) toggle(node, false);
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside);
    return () => { document.removeEventListener("pointerdown", outside, true); document.removeEventListener("focusin", outside); };
  }}>
    <button className="icon-button table-menu-button" aria-haspopup="menu" aria-expanded="false"
      aria-label={name} onClick={e => toggle(e.currentTarget.parentElement!, e.currentTarget.getAttribute("aria-expanded") === "false")}>
      <Icon name={row ? "Row options" : "Column options"} />
      <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 8 4 4 4-4" /></svg>
      <span className="tooltip">{name}</span>
    </button>
    <div role="menu" aria-label={name} className="page-menu table-menu" hidden tabIndex={-1}
      onKeyDown={e => {
        e.stopPropagation();
        if (e.nativeEvent.isComposing) return;
        if (e.key === "Escape") {
          e.preventDefault(); toggle(e.currentTarget.parentElement!, false, true);
        } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const buttons = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
          const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
          buttons[(i + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
        }
      }}>
      <div className="table-menu-heading">{heading}</div>
      {entries.map(item => {
        const reason = tableReason(table, axis, item.at === "delete" ? "delete" : "add");
        return <div key={item.at}>
          {item.at === "delete" && <div role="separator" />}
          <button role="menuitem" disabled={!!reason} title={reason || undefined} className={item.at === "delete" ? "table-danger" : undefined}
            onClick={e => { toggle(e.currentTarget.closest<HTMLElement>(".table-menu-control")!, false); action({ axis, at: item.at }); }}>
            <span>{item.name}</span><small>{item.key}</small>
          </button>
        </div>;
      })}
    </div>
  </span>;
}

const divider = <span className="divider" aria-hidden="true" />;
export function TableControls({ table, selection, edit, done, draft, invalid, readOnly, composing, reason, action, size, exportTable, children }: {
  table: TableItem; selection: TableSelection; edit: () => void; done: () => void; draft?: string; invalid: boolean;
  readOnly: boolean; composing: boolean; reason: string; action: (a: TableAction) => void;
  size: (value: Style["textSize"]) => void; exportTable?: (() => boolean) & { disabled?: boolean; reason?: string }; children?: ReactNode;
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
  </>;
  if (editing) return <>
    <span>Cell</span>{divider}
    <button onMouseDown={e => e.preventDefault()} disabled={composing} onClick={done}><Icon name="Done" />Done</button>
    {divider}{counter}
  </>;
  if (readOnly) return <><span>Cell</span>{divider}{counter}</>;
  if (mode === "Cell") return <>
    <span>Cell</span>{divider}
    <button disabled={!!reason} onClick={edit}><Icon name="pencil" />Edit text</button>{divider}{counter}
    <AxisMenu axis="row" table={table} action={action} />
    <AxisMenu axis="column" table={table} action={action} />
    <TableButton name="Delete content" icon="Delete content" reason={reason} action={() => action({ at: "clear" })} />
  </>;
  const axis = mode === "Row" ? "row" : "column";
  return <><span>{mode}</span>{divider}
    <AxisMenu axis={axis} table={table} action={action} />
    <TableButton name={"Delete " + axis} icon="Delete axis" reason={reason || tableReason(table, axis, "delete")}
      action={() => action({ axis, at: "delete" })} />
  </>;
}
