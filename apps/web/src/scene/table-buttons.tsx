// SPDX-License-Identifier: Apache-2.0
import type { TableItem } from "nextphase-board-rules/document.ts";
import type { Point } from "../selection";
import { tableButtons, tableDimensions, tableReason, type TableAction, type TableGhost, type TableLayout, type TableSelection } from "../table";

export function TableButtons({ object, selection, editing, busy, readOnly, zoom, pos, size, ghost, action, select, focus }: {
  object?: TableItem & { tableLayout?: TableLayout }; selection?: TableSelection;
  editing: boolean; busy: boolean; readOnly: boolean; zoom: number; pos: (p: Point) => { left: number; top: number };
  size: { w: number; h: number }; ghost: TableGhost | null;
  action: (action: TableAction) => void; select: (s: TableSelection, t: TableItem) => void; focus: () => void;
}) {
  if (ghost) {
    const corner = pos({ x: ghost.x + ghost.width, y: ghost.y + ghost.height });
    const label = tableDimensions(ghost);
    return <span className="table-ghost-label" ref={node => {
      if (node) {
        node.style.left = Math.max(0, Math.min(corner.left + 10, size.w - node.offsetWidth)) + "px";
        node.style.top = Math.max(0, Math.min(corner.top + 10, size.h - node.offsetHeight)) + "px";
      }
    }}>{label}</span>;
  }
  if (readOnly || editing || busy || !object?.tableLayout || !selection) return null;
  return <>{tableButtons(object, object.tableLayout, selection, zoom).map(b => {
    const grab = b.action === "select", name = grab ? `Select ${b.axis} ${b.index + 1}` : `Add ${b.axis}`;
    const reason = grab ? "" : tableReason(object, b.axis, "add");
    return <button key={b.action + b.axis} type="button"
      className={grab ? `table-grabber table-grabber-${b.axis}` : `table-add-bar table-add-${b.axis}`}
      aria-label={name} aria-pressed={grab ? b.selected : undefined} title={reason || undefined} disabled={!!reason}
      style={{ ...pos(b), width: b.width * zoom, height: b.height * zoom }}
      onClick={() => {
        if (grab) select(b.axis === "row" ? { kind: "row", row: b.id, id: object.id }
          : { kind: "column", column: b.id, id: object.id }, object);
        else action({ axis: b.axis, at: "end" });
        focus();
      }}>
      {grab ? <><span className="table-grip" aria-hidden="true">{b.selected && <svg width="6" height="10" viewBox="0 0 6 10" fill="white">
        {[0, 4, 8].flatMap(y => [0, 4].map(x => <rect key={x + ":" + y} x={x} y={y} width="2" height="2" />))}
      </svg>}</span><span className="mind-map-tip">{name}</span></> :
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#1665d8" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M7 2.8v8.4M2.8 7h8.4" /></svg>}
    </button>;
  })}</>;
}
