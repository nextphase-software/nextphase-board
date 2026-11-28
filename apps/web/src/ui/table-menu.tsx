// SPDX-License-Identifier: Apache-2.0
import type { TableItem } from "nextphase-board-rules/document.ts";
import type { TableAxis } from "nextphase-board-rules/objects/registry.ts";
import type { TableAction, TableSelection } from "../table";
import { axisMenu } from "../table-arrange";
import { isMac } from "../text-links";
import { Icon } from "../icons";

export function AxisMenu({ axis, table, selection, cells, action }: {
  axis: TableAxis; table: TableItem; selection: TableSelection; cells: number; action: (a: TableAction) => void;
}) {
  const row = axis === "row", name = (row ? "Row" : "Column") + " options";
  const { heading, items } = axisMenu(table, selection, axis, isMac(navigator.platform), cells);
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
      {items.map(item => <div key={item.name}>
        {item.separatorBefore && <div role="separator" />}
        <button role="menuitem" disabled={item.disabled} title={item.reason} className={item.danger ? "table-danger" : undefined}
          onClick={e => { toggle(e.currentTarget.closest<HTMLElement>(".table-menu-control")!, false); action(item.action); }}>
          <span>{item.name}</span><small>{item.key}</small>
        </button>
      </div>)}
    </div>
  </span>;
}
