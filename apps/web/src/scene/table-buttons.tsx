// SPDX-License-Identifier: Apache-2.0
import type { TableItem } from "nextphase-board-rules/document.ts";
import { ARRANGE_WORDS as words, hoverControls, type TableArrangeButtons } from "../table-arrange";
import type { Point } from "../selection";
import { tableButtons, tableDimensions, tableReason, type TableAction, type TableGhost, type TableLayout, type TableSelection } from "../table";

export function TableCellStatus({ announcement }: { announcement: string }) {
  return <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>;
}

export function TableButtons({ object, selection, editing, busy, readOnly, zoom, pos, size, ghost, action, select, focus, arrange, cells = 0 }: {
  object?: TableItem & { tableLayout?: TableLayout }; selection?: TableSelection;
  editing: boolean; busy: boolean; readOnly: boolean; zoom: number; pos: (p: Point) => { left: number; top: number };
  size: { w: number; h: number }; ghost: TableGhost | null;
  arrange?: TableArrangeButtons; cells?: number;
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
  if (readOnly || editing || busy && !arrange?.dragging || !object?.tableLayout || !selection) return null;
  const existing = tableButtons(object, object.tableLayout, selection, zoom);
  const hovered = arrange && !arrange.dragging ? hoverControls(object, object.tableLayout, selection, arrange.hover, zoom, cells) : undefined;
  const buttons = arrange?.dragging ? existing.filter(b => b.action === "select" && b.axis === arrange.dragging!.axis && b.selected)
    : [...existing, ...hovered?.grabbers ?? []];
  const grabbers = buttons.map(b => {
    const grab = b.action === "select", name = grab ? `Select ${b.axis} ${b.index + 1}` : `Add ${b.axis}`;
    const reason = grab ? "" : tableReason(object, b.axis, "add");
    const gestures = arrange && grab ? {
      onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => arrange.press(b, e.nativeEvent, e.currentTarget),
      onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => arrange.move(e.nativeEvent),
      onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => { e.stopPropagation(); arrange.release(e.nativeEvent); },
      onPointerCancel: arrange.lost, onLostPointerCapture: arrange.lost,
      onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (arrange.key(e.nativeEvent)) { e.preventDefault(); e.stopPropagation(); }
      },
    } : undefined;
    return <button key={arrange ? grab ? `select:${b.axis}:${b.id}` : `add:${b.axis}` : b.action + b.axis} type="button"
      className={grab ? `table-grabber table-grabber-${b.axis}` : `table-add-bar table-add-${b.axis}`}
      aria-label={name} aria-pressed={grab ? b.selected : undefined} title={reason || undefined} disabled={!!reason}
      style={{ ...pos(b), width: b.width * zoom, height: b.height * zoom }}
      {...gestures}
      onClick={e => {
        if (grab && arrange) arrange.click(b, e.nativeEvent);
        else if (grab) select(b.axis === "row" ? { kind: "row", row: b.id, id: object.id }
          : { kind: "column", column: b.id, id: object.id }, object);
        else action({ axis: b.axis, at: "end" });
        focus();
      }}>
      {grab ? <><span className="table-grip" aria-hidden="true">{b.selected && <svg width="6" height="10" viewBox="0 0 6 10" fill="white">
        {[0, 4, 8].flatMap(y => [0, 4].map(x => <rect key={x + ":" + y} x={x} y={y} width="2" height="2" />))}
      </svg>}</span><span className="mind-map-tip">{name}</span></> :
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#1665d8" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M7 2.8v8.4M2.8 7h8.4" /></svg>}
    </button>;
  });
  const dots = hovered?.dots.map(dot => <button key={`insert:${dot.axis}:${dot.gap}`} type="button" tabIndex={-1}
      className={`table-insert table-insert-${dot.axis}`} aria-label={dot.name} title={dot.reason || undefined}
      disabled={!!dot.reason} style={pos(dot)} onClick={() => { arrange!.insert(dot.axis, dot.gap); focus(); }}>
      <span className="table-insert-dot" aria-hidden="true">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round"><path d="M5 1.5v7M1.5 5h7" /></svg>
      </span>
      <span className="table-insert-line" aria-hidden="true" style={dot.axis === "row"
        ? { left: 26, top: 11, width: dot.length * zoom, height: 2 }
        : { left: 11, top: 26, width: 2, height: dot.length * zoom }} />
      <span className="tooltip">{dot.reason || words.insertTip(dot.axis)}</span>
    </button>) ?? [];
  const square = arrange?.square && <span key="drag-square" className="table-drag-square" aria-hidden="true" style={pos(arrange.square)} />;
  return <>{arrange ? [...grabbers, ...dots, ...(square ? [square] : [])] : grabbers}</>;
}
