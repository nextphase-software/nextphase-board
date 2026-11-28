// SPDX-License-Identifier: Apache-2.0
import { useRef, useState, type Dispatch, type RefObject, type SetStateAction } from "react";
import { tableCellCount, type Item, type TableItem } from "nextphase-board-rules/document.ts";
import type { Point } from "../selection";
import type { View } from "../view";
import type { TableAction, TableLayout, TableSelection } from "../table";
import { axisSelected, chooseAxis, chooseHow, chosenIds, isRun } from "../table-selection";
import { dragGhost, dragSquare, dragStarts, dropGap, hoverTarget, ownPlace,
  type GrabberRef, type TableArrangeButtons, type TableDragDrawing, type TableHover, type TablePointer } from "../table-arrange";
import { isMac } from "../text-links";

type Gesture = Point & { id: string; cx: number; cy: number; view: View; pan: boolean; pointerId?: number; arrange?: true };
type TableArrangeInput = {
  table?: TableItem & { tableLayout?: TableLayout };
  selection?: TableSelection;
  choose(s: TableSelection, t: TableItem, announcement?: string): void;
  action(a: TableAction): void;
  readOnly: boolean;
  editing: boolean;
  busy: boolean;
  drag: RefObject<Gesture | null>;
  setBusy: Dispatch<SetStateAction<boolean>>;
  board: { objects: readonly Item[] };
  view: View;
  size: { w: number; h: number };
  scene: RefObject<HTMLDivElement | null>;
};
type Press = { grabber: GrabberRef; table: string; pointerId: number; clientX: number; clientY: number; target: Element; start: Point };
type Moving = { press: Press; ids: string[]; point: Point; gate: Gesture };

export function useTableArrange(input: TableArrangeInput) {
  const { table, selection, drag, board, view } = input, layout = table?.tableLayout;
  const [hover, setHover] = useState<TableHover>({});
  const [moving, setMoving] = useState<Moving | null>(null);
  const active = useRef<Moving | null>(null), press = useRef<Press | null>(null);
  const dropClick = useRef(false), live = useRef(input);
  live.current = input;
  const allowed = !!table && !!layout && selection?.id === table.id && !input.readOnly && !input.editing;
  const visible = allowed && !input.busy && !moving && !drag.current;
  if (!visible && (hover.row || hover.column)) setHover({});

  function end(drop = false) {
    const started = active.current, held = press.current, { drag, setBusy } = live.current;
    press.current = null;
    active.current = null;
    if (drop || started) dropClick.current = true;
    if (started) {
      if (drag.current === started.gate) { drag.current = null; setBusy(false); }
      setMoving(null);
    }
    if (held?.target.hasPointerCapture(held.pointerId)) held.target.releasePointerCapture(held.pointerId);
  }
  const cancel = () => end();
  const validDrag = moving && allowed && table.id === moving.press.table &&
    dragStarts(table, moving.press.grabber.axis, moving.ids);
  if (moving && !validDrag) cancel();

  function point(e: { clientX: number; clientY: number }): Point {
    const { scene, view, size } = live.current;
    const rect = scene.current!.getBoundingClientRect();
    return { x: view.x + (e.clientX - rect.left - size.w / 2) / view.z,
      y: view.y + (e.clientY - rect.top - size.h / 2) / view.z };
  }
  function start(grabber: GrabberRef, e: PointerEvent, target: Element) {
    dropClick.current = false;
    const { table, selection, readOnly, editing, busy, drag } = live.current;
    if (!table?.tableLayout || selection?.id !== table.id || readOnly || editing || busy || drag.current ||
        !e.isPrimary || e.button !== 0 || e.shiftKey || e.altKey || e.metaKey || e.ctrlKey) return;
    try { target.setPointerCapture(e.pointerId); }
    catch { return; }
    press.current = { grabber, table: table.id, pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY, target, start: point(e) };
  }
  function move(e: PointerEvent) {
    const held = press.current;
    if (!held || held.pointerId !== e.pointerId) return;
    const { table, selection, choose, readOnly, editing, busy, view, drag, setBusy } = live.current;
    if (!table?.tableLayout || !selection || table.id !== held.table || readOnly || editing || !active.current && busy) {
      end(true); return;
    }
    if (active.current) {
      active.current = { ...active.current, point: point(e) };
      setMoving(active.current);
      return;
    }
    const { axis, id } = held.grabber;
    const distance = axis === "row" ? e.clientY - held.clientY : e.clientX - held.clientX;
    if (Math.abs(distance) < 4) return;
    const chosen = chosenIds(table, selection, axis);
    const reuse = axisSelected(selection, axis) && chosen.includes(id) && isRun(table, axis, chosen);
    const ids = reuse ? chosen : [id];
    if (!dragStarts(table, axis, ids)) { end(true); return; }
    if (!reuse) choose(chooseAxis(table, selection, axis, id), table);
    const gate: Gesture = { id: table.id, ...held.start, cx: held.clientX, cy: held.clientY, view,
      pan: false, pointerId: held.pointerId, arrange: true };
    drag.current = gate;
    setBusy(true);
    active.current = { press: held, ids, point: point(e), gate };
    setMoving(active.current);
  }
  function release(e: PointerEvent) {
    if (press.current?.pointerId !== e.pointerId) return;
    const started = active.current;
    const { table, action, readOnly, editing } = live.current;
    const p = point(e);
    end();
    if (!started || !table?.tableLayout || table.id !== started.press.table || readOnly || editing) return;
    const { axis } = started.press.grabber;
    const gap = dropGap(table, table.tableLayout, axis, started.ids, p);
    if (gap !== undefined && !ownPlace(table, axis, started.ids, gap)) action({ axis, at: "move", to: gap });
  }
  const cells = tableCellCount(board.objects);
  const drawing: TableDragDrawing | null = validDrag ? {
    table: table.id, axis: moving.press.grabber.axis, ids: moving.ids,
    gap: dropGap(table, layout, moving.press.grabber.axis, moving.ids, moving.point),
    ghost: dragGhost(table, layout, moving.press.grabber.axis, moving.ids, moving.press.start, moving.point, view.z),
    square: dragSquare(table, layout, moving.press.grabber.axis, moving.point, view.z),
  } : null;
  const pointer: TablePointer = {
    move(p, e) {
      if (!visible || e.buttons || e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      if (e.target instanceof Element && e.target.closest(".table-grabber,.table-insert")) return;
      const next = hoverTarget(table, layout, p, view.z);
      if (next.row !== hover.row || next.column !== hover.column) setHover(next);
    },
    leave() { setHover({}); },
    dragging: () => !!active.current,
    cancel,
  };
  const buttons: TableArrangeButtons = {
    hover: visible ? hover : {}, dragging: drawing ? moving!.press.grabber : undefined, square: drawing?.square,
    press: start, move, release, lost: cancel,
    key(e) {
      if (e.key !== "Escape" || !active.current) return false;
      cancel(); return true;
    },
    click(g, e) {
      if (dropClick.current) { dropClick.current = false; return; }
      const { table, selection, readOnly, editing, busy, choose } = live.current;
      if (!table || !selection || editing || busy || active.current) return;
      choose(chooseAxis(table, selection, g.axis, g.id, readOnly ? undefined : chooseHow(e, isMac(navigator.platform))), table);
    },
    insert(axis, gap) {
      const { action, busy, editing, readOnly } = live.current;
      if (!busy && !editing && !readOnly && !active.current) action({ axis, at: "insert", gap });
    },
  };
  return { pointer, buttons, drawing, dragging: !!drawing, cells, cancel };
}
